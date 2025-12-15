
interface WorkerConstructor {
    new(): Worker;
}
declare module "*?worker" {
    const worker: WorkerConstructor;
    export default worker;
}
