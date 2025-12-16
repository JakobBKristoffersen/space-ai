import { ScienceManager } from "../game/ScienceManager";
import { ScienceData } from "../simulation/parts/Science";

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

    constructor(private readonly scienceMgr: ScienceManager) { }

    /**
     * Called by rocket simulation when a packet arrives at base.
     */
    receivePacket(packet: { type: string; data: any; sourceId: string; timestamp?: number }) {
        const timestamp = packet.timestamp || Date.now();
        if (packet.type === "science") {
            // Forward to ScienceManager
            this.scienceMgr.onScienceReceived(packet.data as ScienceData);

            // Also log a system message?
            this.addMessage({
                id: Math.random().toString(36).slice(2),
                sender: "SYSTEM",
                timestamp,
                content: `Science Packet Received from ${packet.sourceId}: ${(packet.data as ScienceData).description}`,
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
