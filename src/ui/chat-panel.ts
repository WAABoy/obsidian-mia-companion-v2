import { ItemView, WorkspaceLeaf } from 'obsidian';

export const CHAT_VIEW_TYPE = 'mia-chat';

export class ChatView extends ItemView {
    constructor(leaf: WorkspaceLeaf) {
        super(leaf);
    }
    
    getViewType(): string {
        return CHAT_VIEW_TYPE;
    }
    
    getDisplayText(): string {
        return 'Mia Chat';
    }
    
    async onOpen(): Promise<void> {
        const container = this.containerEl.children[1];
        container.empty();
        container.createEl('h3', { text: '🌸 Chat with Mia' });
        container.createEl('p', { text: 'Connect to OpenClaw to start chatting!' });
    }
}
