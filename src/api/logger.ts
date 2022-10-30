import {Log, LogStats} from "../../generated/schema";

export class Logger {
    protected stats: LogStats;
    protected logs: Array<Log> = [];

    public error(key: string, message: string): void {
        const log = new Log(this.getId());
        log.key = key;
        log.message = message;

        this.logs.push(log);
    }

    public save(): void {
        this.stats.save();

        for(let i = 0; i < this.logs.length; i++) {
            const l = this.logs[i];
            l.save();
        }
    }

    protected getId(): string {
        let stats = LogStats.load('_');

        if (!stats) {
           stats = new LogStats('_');
           stats.count = 0 as i32;
        }
        this.stats = stats;
        this.stats.count++;

        return this.stats.count.toString();
    }
}
