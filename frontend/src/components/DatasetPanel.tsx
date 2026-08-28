import React, { useEffect, useState } from 'react';
import { Database, Folder, Table, ShieldCheck, History } from 'lucide-react';

interface DatasetPanelProps {
  onSelectRun: (runId: string) => void;
  selectedRunId: string;
}

export default function DatasetPanel({ onSelectRun, selectedRunId }: DatasetPanelProps) {
  const [runs, setRuns] = useState<any[]>([]);

  useEffect(() => {
    fetch('/api/runs')
      .then(res => res.json())
      .then(data => setRuns(data))
      .catch(err => console.error("Error loading runs:", err));
  }, [selectedRunId]);

  return (
    <div className="space-y-6">
      {/* 1. Model Registry */}
      <div className="bg-aerospace-900 border border-aerospace-750 p-5 rounded-lg">
        <h3 className="text-sm font-semibold text-aerospace-200 uppercase tracking-wider font-mono mb-4 flex items-center gap-1.5">
          <Database size={16} className="text-cyan-400" /> Active Model Registry
        </h3>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs font-mono border-collapse">
            <thead>
              <tr className="border-b border-aerospace-800 text-aerospace-400">
                <th className="pb-2 font-semibold">Model ID</th>
                <th className="pb-2 font-semibold">Architecture</th>
                <th className="pb-2 font-semibold">Scale</th>
                <th className="pb-2 font-semibold">PSNR (dB)</th>
                <th className="pb-2 font-semibold">SSIM</th>
                <th className="pb-2 font-semibold">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-aerospace-800/60 text-aerospace-300">
              <tr className="hover:bg-aerospace-850/40">
                <td className="py-2.5 font-bold text-white">bicubic</td>
                <td className="py-2.5">Bicubic Interpolation</td>
                <td className="py-2.5">5x</td>
                <td className="py-2.5">23.1 dB</td>
                <td className="py-2.5">0.74</td>
                <td className="py-2.5"><span className="px-1.5 py-0.5 rounded bg-emerald-950 text-emerald-400 border border-emerald-800">READY</span></td>
              </tr>
              <tr className="hover:bg-aerospace-850/40">
                <td className="py-2.5 font-bold text-white">edsr</td>
                <td className="py-2.5">Enhanced Deep Residual Net</td>
                <td className="py-2.5">5x</td>
                <td className="py-2.5">26.4 dB</td>
                <td className="py-2.5">0.83</td>
                <td className="py-2.5"><span className="px-1.5 py-0.5 rounded bg-emerald-950 text-emerald-400 border border-emerald-800">READY</span></td>
              </tr>
              <tr className="hover:bg-aerospace-850/40">
                <td className="py-2.5 font-bold text-white">swinir</td>
                <td className="py-2.5">Swin Transformer restorer</td>
                <td className="py-2.5">5x</td>
                <td className="py-2.5">27.1 dB</td>
                <td className="py-2.5">0.85</td>
                <td className="py-2.5"><span className="px-1.5 py-0.5 rounded bg-emerald-950 text-emerald-400 border border-emerald-800">READY</span></td>
              </tr>
              <tr className="hover:bg-aerospace-850/40">
                <td className="py-2.5 font-bold text-white">lunarsr</td>
                <td className="py-2.5">Crater-Edge Attention Fused</td>
                <td className="py-2.5">5x</td>
                <td className="py-2.5">28.5 dB</td>
                <td className="py-2.5">0.88</td>
                <td className="py-2.5"><span className="px-1.5 py-0.5 rounded bg-emerald-950 text-emerald-400 border border-emerald-800">READY</span></td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* 2. Geographic splits info */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-aerospace-900 border border-aerospace-750 p-5 rounded-lg space-y-4">
          <h3 className="text-sm font-semibold text-aerospace-200 uppercase tracking-wider font-mono flex items-center gap-1.5">
            <ShieldCheck size={16} className="text-cyan-400" /> Geographic split setup
          </h3>
          <p className="text-xs text-aerospace-400 leading-relaxed">
            To prevent **spatial data leakage** common in remote sensing tasks, the training datasets are split geographically rather than randomly selecting neighboring pixels. This ensures the validation dataset represents unseen lunar topography.
          </p>
          <div className="p-4 bg-aerospace-950 border border-aerospace-800 rounded font-mono text-[10px] space-y-2 text-aerospace-300">
            <div className="font-bold text-cyan-400">GEOGRAPHIC PARTITION PLAN:</div>
            <div className="flex justify-between border-b border-aerospace-900 pb-1">
              <span>Region A (X: 0-300, Y: 0-300)</span>
              <span className="text-emerald-400">→ TRAINING SPLIT</span>
            </div>
            <div className="flex justify-between border-b border-aerospace-900 pb-1">
              <span>Region B (X: 300-500, Y: 0-300)</span>
              <span className="text-amber-400">→ VALIDATION SPLIT</span>
            </div>
            <div className="flex justify-between">
              <span>Region C (X: 0-500, Y: 300-500)</span>
              <span className="text-purple-400">→ TEST SPLIT</span>
            </div>
          </div>
        </div>

        {/* Dataset file info */}
        <div className="bg-aerospace-900 border border-aerospace-750 p-5 rounded-lg space-y-4">
          <h3 className="text-sm font-semibold text-aerospace-200 uppercase tracking-wider font-mono flex items-center gap-1.5">
            <Folder size={16} className="text-cyan-400" /> Demo Dataset files
          </h3>
          <div className="space-y-3 font-mono text-xs">
            <div className="flex justify-between items-center bg-aerospace-950/60 p-2 rounded border border-aerospace-800">
              <div>
                <div className="text-white font-semibold">synthetic_tmc.png</div>
                <div className="text-[10px] text-aerospace-500">100x100 grayscale PNG</div>
              </div>
              <span className="px-2 py-0.5 rounded text-[10px] bg-blue-950 text-blue-300">TMC 5m (OBSERVED)</span>
            </div>
            
            <div className="flex justify-between items-center bg-aerospace-950/60 p-2 rounded border border-aerospace-800">
              <div>
                <div className="text-white font-semibold">synthetic_dem.png</div>
                <div className="text-[10px] text-aerospace-500">500x500 16-bit height PNG</div>
              </div>
              <span className="px-2 py-0.5 rounded text-[10px] bg-emerald-950 text-emerald-300">DEM 1m (DERIVED)</span>
            </div>
            
            <div className="flex justify-between items-center bg-aerospace-950/60 p-2 rounded border border-aerospace-800">
              <div>
                <div className="text-white font-semibold">synthetic_ohrc.png</div>
                <div className="text-[10px] text-aerospace-500">2000x2000 grayscale PNG</div>
              </div>
              <span className="px-2 py-0.5 rounded text-[10px] bg-purple-950 text-purple-300">OHRC 25cm (REFERENCE)</span>
            </div>
          </div>
        </div>
      </div>

      {/* 3. Run History */}
      <div className="bg-aerospace-900 border border-aerospace-750 p-5 rounded-lg">
        <h3 className="text-sm font-semibold text-aerospace-200 uppercase tracking-wider font-mono mb-4 flex items-center gap-1.5">
          <History size={16} className="text-cyan-400" /> Mission Audit & Run Logs
        </h3>
        {runs.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs font-mono border-collapse">
              <thead>
                <tr className="border-b border-aerospace-800 text-aerospace-400">
                  <th className="pb-2 font-semibold">Run ID</th>
                  <th className="pb-2 font-semibold">Model</th>
                  <th className="pb-2 font-semibold">Mode</th>
                  <th className="pb-2 font-semibold">Duration</th>
                  <th className="pb-2 font-semibold">Status</th>
                  <th className="pb-2 font-semibold">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-aerospace-800/60 text-aerospace-300">
                {runs.map((run, idx) => (
                  <tr key={idx} className={`hover:bg-aerospace-850/40 ${selectedRunId === run.job_id ? 'bg-cyan-950/20' : ''}`}>
                    <td className="py-2.5 font-bold text-cyan-400">{run.job_id}</td>
                    <td className="py-2.5 uppercase">{run.sr_model}</td>
                    <td className="py-2.5 uppercase">{run.mode}</td>
                    <td className="py-2.5">{run.elapsed_time.toFixed(1)}s</td>
                    <td className="py-2.5">
                      <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                        run.status === 'COMPLETED' ? 'bg-emerald-950 text-emerald-400' : 'bg-amber-950 text-amber-400'
                      }`}>
                        {run.status}
                      </span>
                    </td>
                    <td className="py-2.5">
                      <button 
                        onClick={() => onSelectRun(run.job_id)} 
                        className="px-2.5 py-1 bg-cyan-950/80 hover:bg-cyan-900 border border-cyan-700 text-cyan-200 rounded font-semibold text-[10px]"
                      >
                        Inspect
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="text-center py-6 text-aerospace-500 text-xs">No prior runs recorded.</div>
        )}
      </div>
    </div>
  );
}
