// 任务的调度 queue 收集任务

export interface SchedulerJob extends Function {
  id?: number;
  pre?: boolean;
  active?: boolean;
  computed?: boolean;
  allowRecurse?: boolean;
  //ownerInstance?: ComponentInternalInstance
}

const queue: SchedulerJob[] = [];
let flushIndex = 0;
let isFlushing = false;
const resolvedPromise = Promise.resolve() as Promise<any>;
let currentFlushPromise: Promise<void> | null = null;

export function nextTick<T = void>(
  this: T,
  fn?: (this: T) => void
): Promise<void> {
  const p = currentFlushPromise || resolvedPromise;
  return fn ? p.then(this ? fn.bind(this) : fn) : p;
}

function findInsertionIndex(id: number) {
  let start = flushIndex + 1;
  let end = queue.length;

  while (start < end) {
    const middle = (start + end) >>> 1;
    const middelJobId = getId(queue[middle]);
    middelJobId < id ? (start = middle + 1) : (end = middle);
  }
  return start;
}

const getId = (job: SchedulerJob): number =>
  job.id == null ? Infinity : job.id;

// 任务入列
export function queueJob(job: SchedulerJob) {
  if (!queue.length || !queue.includes(job)) {
    if (job.id == null) {
      queue.push(job);
    } else {
      queue.splice(findInsertionIndex(job.id), 0, job);
    }
    queueFlush();
  }
}

function queueFlush() {
  if (!isFlushing) {
    isFlushing = true;
    currentFlushPromise = resolvedPromise.then(flushJobs);
  }
}

// 执行所有任务
function flushJobs() {
  try {
    for (flushIndex = 0; flushIndex < queue.length; flushIndex++) {
      const job = queue[flushIndex];
      job();
    }
  } finally {
    flushIndex = 0;
    isFlushing = false;
    queue.length = 0;
    currentFlushPromise = null;
  }
}
