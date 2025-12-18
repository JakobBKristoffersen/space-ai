import { ScienceManager } from "../game/ScienceManager";
import { UpgradesService } from "../app/services/UpgradesService";


export interface CommsMessage {
    id: string;
    sender: string;
    timestamp: number;
    content: string;
    read: boolean;
}

export class CommsService {
    private messages: CommsMessage[] = [];
    private kvStore: Map<string, any> = new Map();
    private listeners: (() => void)[] = [];

    constructor(private readonly scienceMgr: ScienceManager, private readonly upgrades: UpgradesService) { }

    /**
     * Called by rocket simulation when a packet arrives at base.
     */
    receivePacket(packet: { type: string; data: any; sourceId: string; timestamp?: number }) {
        const timestamp = packet.timestamp || Date.now();
        if (packet.type === "science_data_bulk") {
            const { type, values } = packet.data;
            // Forward to ScienceManager
            this.scienceMgr.onBulkDataReceived(type, values);

            // Log system message
            const count = Object.keys(values || {}).length;
            this.addMessage({
                id: Math.random().toString(36).slice(2),
                sender: "SYSTEM",
                timestamp,
                content: `Received ${count} ${type} readings from ${packet.sourceId}`,
                read: false
            });
        } else if (packet.type === "message") {
            const content = typeof packet.data === "string" ? packet.data : JSON.stringify(packet.data);
            this.addMessage({
                id: Math.random().toString(36).slice(2),
                sender: packet.sourceId,
                timestamp,
                content: content,
                read: false
            });
        } else if (packet.type === "kv_update") {
            const { key, value } = packet.data;
            if (key) {
                // Check limits
                if (!this.kvStore.has(key)) {
                    const lvl = this.upgrades.getLevel("comms");
                    const max = this.upgrades.getMaxKVKeys(lvl);
                    if (this.kvStore.size >= max) {
                        // Drop and warn once?
                        // Just drop for now.
                        return;
                    }
                }

                this.kvStore.set(key, value);
                this.notify();
            }
        }
    }

    private addMessage(msg: CommsMessage) {
        this.messages.unshift(msg);
        this.notify();
    }

    getMessages(): CommsMessage[] {
        return this.messages;
    }

    getKVStore(): Record<string, any> {
        return Object.fromEntries(this.kvStore);
    }

    markAsRead(id: string) {
        const m = this.messages.find(x => x.id === id);
        if (m) {
            m.read = true;
            this.notify();
        }
    }

    subscribe(fn: () => void): () => void {
        this.listeners.push(fn);
        return () => { this.listeners = this.listeners.filter(l => l !== fn); };
    }

    private notify() {
        this.listeners.forEach(l => l());
    }
}
