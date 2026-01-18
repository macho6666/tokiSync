import { claimNextTask, completeTask, releaseTask, getMyStats } from './queue.js';
import { tokiDownloadSingle } from './downloader.js';
import { updateStatus, log } from './logger.js';
import { injectDashboard } from './ui.js';

let GM = null;
let isWorkerRunning = false;
const WORKER_ID = `worker_${Date.now()}`;

// Heartbeat Logic
const HEARTBEAT_KEY = "TOKI_WORKER_HEARTBEAT";

export function initWorker(gmContext) {
    GM = gmContext;
}

function updateHeartbeat() {
    if(GM) GM.setValue(HEARTBEAT_KEY, Date.now());
}

export async function isWorkerAlive() {
    if(!GM) return false;
    const lastBeat = await GM.getValue(HEARTBEAT_KEY, 0);
    return (Date.now() - lastBeat) < 5000; // Alive if beat within 5 sec
}

export async function startWorker(isDedicated = false) {
    if (isWorkerRunning) return;
    isWorkerRunning = true;

    log(`👷 Worker Started (ID: ${WORKER_ID}, Dedicated: ${isDedicated})`);
    if (isDedicated) injectDashboard(); // Disguise only if dedicated worker window

    while (true) {
        try {
            updateHeartbeat();
            updateDashboardStats(); // Update UI
            
            const task = claimNextTask(WORKER_ID);
            if (task) {
                updateStatus(`🔨 작업 중: ${task.title}`);
                log(`Processing task: ${task.title}`);
                await tokiDownloadSingle(task);
                completeTask(task.id);
                updateStatus(`✅ 완료: ${task.title}`);
            } else {
                updateStatus("💤 대기 중... (큐 비어있음)");
                await sleep(2000); // Faster polling for responsiveness
            }
        } catch (e) {
             // ...
             await sleep(5000);
        }
    }
}

function updateDashboardStats() {
    const stats = getMyStats(WORKER_ID);
    // UI Update Logic (Hooks into ui.js)
    // For now, implicit update via status text
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }
