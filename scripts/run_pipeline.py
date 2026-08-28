import os
import json
import time
from backend.app.services.jobs import BackgroundJobExecutor

def main():
    print("====================================================")
    print("LunarSafe AI — CLI Pipeline Execution Runner")
    print("====================================================")
    
    # 1. Start job payload
    payload = {
        "mode": "demo",
        "sr_model": "edsr",
        "start_point": [50, 450]
    }
    
    # Inject default configurations
    import yaml
    config_path = "configs/default.yaml"
    if os.path.exists(config_path):
        with open(config_path, "r") as f:
            payload["config"] = yaml.safe_load(f)
            
    print("Starting background analysis job...")
    job_id = BackgroundJobExecutor.create_job(payload)
    BackgroundJobExecutor.run(job_id)
    
    # 2. Poll job status
    print(f"Monitoring Job ID: {job_id}")
    while True:
        job = BackgroundJobExecutor.get_job(job_id)
        if not job:
            print("Job could not be retrieved.")
            break
            
        print(f"[{job['status']}] {job['progress']:.0f}%: {job['current_stage']} (Elapsed: {job['elapsed_time']:.1f}s)")
        
        if job["status"] == "COMPLETED":
            print("\n====================================================")
            print("PIPELINE RUN SUCCESSFULLY COMPLETED!")
            print("====================================================")
            print(f"Run ID: {job_id}")
            print(f"Upscale Model: {job['results']['sr_model'].upper()}")
            print(f"Craters Detected: {job['results']['hazard_stats']['detected_craters']}")
            print(f"Boulders Detected: {job['results']['hazard_stats']['detected_boulders']}")
            print(f"False-Safe Rate: {job['results']['hazard_stats']['false_safe_rate'] * 100:.2f}%")
            if job['results']['best_candidate']:
                print(f"Best Landing Site: {job['results']['best_candidate']['id']} at Grid [{job['results']['best_candidate']['x']}, {job['results']['best_candidate']['y']}]")
                print(f"Landing Suitability Score: {job['results']['best_candidate']['score']:.1f}/100")
            print("Exported files located in:")
            print(f"- data/processed/{job_id}/")
            break
        elif job["status"] == "FAILED":
            print(f"\nPipeline run failed: {job['error_message']}")
            break
            
        time.sleep(2.0)

if __name__ == "__main__":
    main()
