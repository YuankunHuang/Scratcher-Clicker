'use strict';

const E = typeof Editor !== 'undefined' ? Editor : require('editor');

const tools = [require('../tools/window-manager')];

const LANG_KEY = 'toolbox_lang';

const SIDEBAR_I18N = {
    en: { uiTools: 'UI Tools' },
    zh: { uiTools: 'UI 工具' },
};

const TOOL_LABELS = {
    en: { 'Window Manager': 'Window Manager' },
    zh: { 'Window Manager': '窗口管理器' },
};

function getLang() {
    try { return localStorage.getItem(LANG_KEY) === 'zh' ? 'zh' : 'en'; } catch { return 'en'; }
}

function setLang(lang) {
    try { localStorage.setItem(LANG_KEY, lang); } catch {}
}

module.exports = E.Panel.define({
    template: `
<div class="toolbox-root">
  <aside class="toolbox-sidebar">
    <div class="toolbox-section-label" id="toolbox-section-label">UI Tools</div>
    <div id="toolbox-sidebar-btns" class="toolbox-sidebar-btns"></div>
    <div class="toolbox-sidebar-footer">
      <button type="button" class="toolbox-lang-btn" id="toolbox-lang-btn">中文</button>
    </div>
  </aside>
  <main class="toolbox-main" id="toolbox-tool-content"></main>
</div>
`,

    style: `
.toolbox-root {
  display: flex;
  flex-direction: row;
  height: 100%;
  box-sizing: border-box;
  font-size: 12px;
  color: var(--color-normal-contrast, #ddd);
}
.toolbox-sidebar {
  width: 180px;
  min-width: 160px;
  border-right: 1px solid var(--color-normal-border, #444);
  padding: 8px;
  box-sizing: border-box;
  background: var(--color-normal-fill-emphasis, #2a2a2a);
  overflow-y: auto;
  display: flex;
  flex-direction: column;
}
.toolbox-section-label {
  font-weight: 600;
  opacity: 0.85;
  margin-bottom: 8px;
  padding: 4px 0;
}
.toolbox-sidebar-btns {
  display: flex;
  flex-direction: column;
  gap: 4px;
  flex: 1;
}
.toolbox-sidebar-footer {
  padding-top: 8px;
  border-top: 1px solid var(--color-normal-border, #444);
  margin-top: 8px;
}
.toolbox-lang-btn {
  width: 100%;
  padding: 5px 0;
  border: 1px solid var(--color-normal-border, #444);
  border-radius: 3px;
  background: var(--color-normal-fill, #333);
  color: inherit;
  cursor: pointer;
  font-size: 11px;
  letter-spacing: 0.05em;
}
.toolbox-lang-btn:hover { filter: brightness(1.12); }
.toolbox-tool-btn {
  text-align: left;
  padding: 8px 10px;
  border: 1px solid var(--color-normal-border, #444);
  border-radius: 3px;
  background: var(--color-normal-fill, #333);
  color: inherit;
  cursor: pointer;
}
.toolbox-tool-btn:hover { filter: brightness(1.08); }
.toolbox-tool-btn.active {
  border-color: var(--color-focus-border-emphasis, #09f);
  background: var(--color-focus-fill-emphasis, #1a3a5c);
}
.toolbox-main {
  flex: 1;
  min-width: 0;
  padding: 12px;
  overflow: auto;
  box-sizing: border-box;
}
`,

    $: {
        sidebar:       '#toolbox-sidebar-btns',
        sectionLabel:  '#toolbox-section-label',
        toolContent:   '#toolbox-tool-content',
        langBtn:       '#toolbox-lang-btn',
    },

    ready() {
        this._tools        = tools;
        this._currentTool  = null;
        this._currentHandle = null;
        this._lang         = getLang();
        this._ipc          = (msg, payload) => E.Message.request('toolbox', msg, payload);

        this.renderSidebar();
        this.applyLangLabels();
        this.selectTool(0);

        this._onSidebarClick = (e) => {
            const btn = e.target.closest('.toolbox-tool-btn');
            if (!btn) return;
            const i = parseInt(btn.dataset.index, 10);
            if (Number.isNaN(i)) return;
            this.selectTool(i);
        };
        this.$.sidebar.addEventListener('click', this._onSidebarClick);

        this._onLangClick = () => {
            this._lang = this._lang === 'en' ? 'zh' : 'en';
            setLang(this._lang);
            this.applyLangLabels();
            this.renderSidebar();
            // 重新渲染当前工具（右侧内容跟随语言刷新）
            if (this._currentTool) {
                const idx = this._currentIndex;
                this._currentTool.onUnmount(this._currentHandle);
                this._currentTool  = null;
                this._currentHandle = null;
                this.selectTool(idx);
            }
        };
        this.$.langBtn.addEventListener('click', this._onLangClick);
    },

    close() {
        if (this._currentTool) {
            this._currentTool.onUnmount(this._currentHandle);
            this._currentTool  = null;
            this._currentHandle = null;
        }
        if (this.$.sidebar && this._onSidebarClick) {
            this.$.sidebar.removeEventListener('click', this._onSidebarClick);
        }
        if (this.$.langBtn && this._onLangClick) {
            this.$.langBtn.removeEventListener('click', this._onLangClick);
        }
    },

    methods: {
        applyLangLabels() {
            const lang = this._lang;
            this.$.sectionLabel.textContent = SIDEBAR_I18N[lang].uiTools;
            // 切换按钮显示"对方语言"，点了就切过去
            this.$.langBtn.textContent = lang === 'en' ? '中文' : 'English';
        },

        renderSidebar() {
            const lang = this._lang;
            this.$.sidebar.innerHTML = this._tools
                .map((t, i) => {
                    const label = (TOOL_LABELS[lang] && TOOL_LABELS[lang][t.label]) || t.label;
                    const active = i === (this._currentIndex ?? 0) ? ' active' : '';
                    return `<button type="button" class="toolbox-tool-btn${active}" data-index="${i}">${label}</button>`;
                })
                .join('');
        },

        selectTool(index) {
            if (index < 0 || index >= this._tools.length) return;
            if (this._currentTool) {
                this._currentTool.onUnmount(this._currentHandle);
                this._currentTool  = null;
                this._currentHandle = null;
            }
            this._currentIndex  = index;
            this._currentTool   = this._tools[index];
            const lang          = this._lang;
            this.$.toolContent.innerHTML = this._currentTool.renderHTML(lang);
            this._currentHandle = this._currentTool.onMount(this.$.toolContent, {
                ipc: this._ipc,
                lang,
            });
            this.$.sidebar.querySelectorAll('.toolbox-tool-btn').forEach((b, i) => {
                b.classList.toggle('active', i === index);
            });
        },
    },
});
