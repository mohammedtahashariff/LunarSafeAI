import time
import heapq
import numpy as np

def get_neighbors(y: int, x: int, shape: tuple) -> list:
    """
    Returns 8-connectivity neighbors of a cell (y, x) with boundaries.
    """
    h, w = shape
    neighbors = []
    # 8-direction vectors
    directions = [
        (-1, 0, 1.0), (1, 0, 1.0), (0, -1, 1.0), (0, 1, 1.0),  # Orthogonal
        (-1, -1, 1.414), (-1, 1, 1.414), (1, -1, 1.414), (1, 1, 1.414) # Diagonal
    ]
    
    for dy, dx, dist in directions:
        ny, nx = y + dy, x + dx
        if 0 <= ny < h and 0 <= nx < w:
            neighbors.append((ny, nx, dist))
    return neighbors

def plan_route(
    start: tuple,
    goal: tuple,
    fused_hazard: np.ndarray,
    uncertainty: np.ndarray,
    slope: np.ndarray,
    roughness: np.ndarray,
    shadow: np.ndarray,
    no_data_mask: np.ndarray,
    config: dict,
    algorithm: str = "astar"
) -> dict:
    """
    Computes a risk-aware path from start (x, y) to goal (x, y).
    Supports 'astar' and 'dijkstra'.
    
    Returns:
        result (dict): Status, path (list of coords), and path metrics.
    """
    start_time = time.time()
    
    # Grid shapes
    shape = fused_hazard.shape
    h, w = shape
    
    # Config parameters
    nc = config.get("navigation", {})
    w_haz = nc.get("hazard_penalty", 5.0)
    w_unc = nc.get("uncertainty_penalty", 5.0)
    w_slope = nc.get("slope_penalty", 3.0)
    w_rough = nc.get("roughness_penalty", 2.0)
    w_shadow = nc.get("shadow_penalty", 2.0)
    unknown_blocked = nc.get("unknown_blocked", True)
    extreme_blocked = nc.get("extreme_blocked", True)
    
    # Convert start/goal from (x, y) coordinates to (y, x) array indices
    start_y, start_x = int(start[1]), int(start[0])
    goal_y, goal_x = int(goal[1]), int(goal[0])
    
    # 1. Check validation/failure states before starting search
    if start_y < 0 or start_y >= h or start_x < 0 or start_x >= w:
        return {"status": "START_IN_HAZARD", "path": [], "metrics": {}}
    if goal_y < 0 or goal_y >= h or goal_x < 0 or goal_x >= w:
        return {"status": "GOAL_UNREACHABLE", "path": [], "metrics": {}}
        
    # Check if start or goal is blocked
    def is_blocked(y: int, x: int) -> bool:
        if no_data_mask is not None and not no_data_mask[y, x]:
            return True
        if extreme_blocked and fused_hazard[y, x] >= 0.8:
            return True
        if unknown_blocked and uncertainty[y, x] >= 0.75:
            return True
        return False
        
    if is_blocked(start_y, start_x):
        return {"status": "START_IN_HAZARD", "path": [], "metrics": {}}
    if is_blocked(goal_y, goal_x):
        return {"status": "GOAL_UNREACHABLE", "path": [], "metrics": {}}

    # 2. Pathfinding execution (A* or Dijkstra)
    # Priority Queue: stores (priority_score, y, x, current_g_cost)
    pq = []
    # g_score: stores minimum cost to reach each cell
    g_score = np.full(shape, np.inf)
    # parent: tracks back-pointers for reconstruction
    parent = {}
    
    # Initialize start
    g_score[start_y, start_x] = 0.0
    start_h = 0.0
    if algorithm == "astar":
        # Heuristic: Euclidean distance to goal
        start_h = np.sqrt((start_x - goal_x)**2 + (start_y - goal_y)**2)
        
    heapq.heappush(pq, (start_h, start_y, start_x))
    
    nodes_expanded = 0
    path_found = False
    
    while pq:
        f, y, x = heapq.heappop(pq)
        nodes_expanded += 1
        
        if y == goal_y and x == goal_x:
            path_found = True
            break
            
        current_g = g_score[y, x]
        
        # Expand neighbors
        for ny, nx, step_dist in get_neighbors(y, x, shape):
            if is_blocked(ny, nx):
                continue
                
            # Compute cell travel cost
            # Base cost is physical step distance
            cell_cost = step_dist
            
            # Add risk penalties
            cell_cost += w_haz * fused_hazard[ny, nx]
            cell_cost += w_unc * uncertainty[ny, nx]
            cell_cost += w_shadow * shadow[ny, nx]
            
            if slope is not None:
                # Normalize slope to [0, 1] relative to threshold
                cell_cost += w_slope * np.clip(slope[ny, nx] / 15.0, 0.0, 1.0)
                cell_cost += w_rough * np.clip(roughness[ny, nx] / 0.5, 0.0, 1.0)
                
            tentative_g = current_g + cell_cost
            
            if tentative_g < g_score[ny, nx]:
                g_score[ny, nx] = tentative_g
                parent[(ny, nx)] = (y, x)
                
                # Priority valuation
                h_val = 0.0
                if algorithm == "astar":
                    h_val = np.sqrt((nx - goal_x)**2 + (ny - goal_y)**2)
                    
                heapq.heappush(pq, (tentative_g + h_val, ny, nx))

    # 3. Path reconstruction
    if not path_found:
        return {"status": "NO_SAFE_ROUTE", "path": [], "metrics": {}}
        
    path = []
    curr = (goal_y, goal_x)
    while curr in parent:
        path.append((int(curr[1]), int(curr[0]))) # Convert to (x, y)
        curr = parent[curr]
    path.append((int(start[0]), int(start[1])))
    path.reverse()
    
    # 4. Calculate metrics
    elapsed_time = time.time() - start_time
    
    path_len = 0.0
    max_hazard = 0.0
    total_hazard = 0.0
    hazard_cells_count = 0
    
    for idx in range(len(path) - 1):
        p1 = path[idx]
        p2 = path[idx+1]
        step = np.sqrt((p1[0]-p2[0])**2 + (p1[1]-p2[1])**2)
        path_len += step
        
        px, py = p2
        h_val = fused_hazard[py, px]
        max_hazard = max(max_hazard, h_val)
        total_hazard += h_val
        if h_val >= 0.20: # Low/Mod/High/Extreme thresholds
            hazard_cells_count += 1
            
    metrics = {
        "path_length_m": float(path_len),
        "total_cost": float(g_score[goal_y, goal_x]),
        "max_hazard_encountered": float(max_hazard),
        "average_hazard": float(total_hazard / max(1, len(path) - 1)),
        "hazard_cells_crossed": int(hazard_cells_count),
        "nodes_expanded": int(nodes_expanded),
        "planning_time_ms": float(elapsed_time * 1000.0)
    }
    
    return {
        "status": "SUCCESS",
        "path": path,
        "metrics": metrics
    }
