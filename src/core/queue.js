import { getConfig } from './config.js';
import { log, updateStatus } from './logger.js';

let GM = null;
const QUEUE_KEY = "TOKI_QUEUE";
const LOCK_KEY = "TOKI_WORKER_LOCK"; // Task-level lock is managed inside queue items, this is for "Highlander" check if needed

export function initQueue(gmContext) {
    GM = gmContext;
}

export function getQueue() {
    return GM.getValue(QUEUE_KEY, []);
}

export function setQueue(q) {
    GM.setValue(QUEUE_KEY, q);
}

export function enqueueTask(task) {
    // task: { id, title, url, site }
    const q = getQueue();
    const existing = q.find(t => t.id === task.id);
    if (existing) {
        // If task is stuck in 'working' or failed, allow retry
        if (existing.status !== 'pending') {
            log(`🔄 Re-queueing stuck/completed task: ${task.title}`);
            existing.status = 'pending';
            existing.workerId = null;
            existing.updatedAt = Date.now();
            setQueue(q);
            return true;
        }
        log(`Duplicate task ignored (Already Pending): ${task.title}`);
        return false;
    }
    const queueItem = {
        ...task,
        status: 'pending', // pending, working, completed, failed
        addedAt: Date.now(),
        workerId: null,
        updatedAt: Date.now()
    };
    q.push(queueItem);
    setQueue(q);
    log(`Enqueue: ${task.title}`);
    return true;
}

export function claimNextTask(workerId) {
    const q = getQueue();
    // 1. Clean up stale tasks (working > 10 mins)
    const now = Date.now();
    let dirty = false;
    q.forEach(t => {
        if (t.status === 'working' && (now - t.updatedAt > 10 * 60 * 1000)) {
             log(`Hitman: Resetting stale task ${t.title}`);
             t.status = 'pending';
             t.workerId = null;
             dirty = true;
        }
    });

    // 2. Find pending
    const candidate = q.find(t => t.status === 'pending');
    if (candidate) {
        candidate.status = 'working';
        candidate.workerId = workerId;
        candidate.updatedAt = now;
        setQueue(q); // Save lock
        return candidate;
    }
    
    if (dirty) setQueue(q);
    return null;
}

export function completeTask(taskId) {
    let q = getQueue();
    // Remove completed task
    const initialLen = q.length;
    q = q.filter(t => t.id !== taskId);
    if (q.length !== initialLen) {
        setQueue(q);
        log(`Task Completed & Removed: ${taskId}`);
        return true;
    }
    return false;
}

export function releaseTask(taskId) {
    const q = getQueue();
    const task = q.find(t => t.id === taskId);
    if (task) {
        task.status = 'pending';
        task.workerId = null;
        task.updatedAt = Date.now();
        setQueue(q);
        log(`Task Released (Retry): ${taskId}`);
    }
}

export function getMyStats(workerId) {
    // For Dashboard UI
    const q = getQueue();
    const pending = q.filter(t => t.status === 'pending').length;
    const working = q.filter(t => t.status === 'working').length;
    const myTask = q.find(t => t.workerId === workerId && t.status === 'working');
    return { pending, working, total: q.length, myTask };
}
