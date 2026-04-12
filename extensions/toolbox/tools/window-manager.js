'use strict';

const LAYERS = ['Normal', 'Dialog', 'Popup', 'Top'];

const I18N = {
    en: {
        tabNew:           'New',
        tabEdit:          'Edit',
        tabDelete:        'Delete',
        windowName:       'Window name (PascalCase)',
        windowNamePh:     'ShopWindow',
        prefabPath:       'Prefab path (under resources/)',
        layer:            'Layer',
        stackable:        'stackable',
        showMask:         'showMask',
        maskClickClose:   'maskClickClose',
        blurBackground:   'blurBackground',
        destroyOnCovered: 'destroyOnCovered',
        btnCreate:        'Create window',
        windowSelect:     '— select —',
        btnSave:          'Save attributes',
        btnDelete:        'Delete selected',
        windowNamesNote:  'WindowNames.ts — entry added',
        indexNote:        'index.ts — import added',
        prefabNote:       'Prefab (create manually in editor)',
        errName:              'Enter a window name.',
        errSelect:            'Select a window.',
        errNoneSelected:      'Select at least one window.',
        confirmDeleteTitle:   (names) => `Delete ${names}?`,
        confirmDeleteDetail:  (files) => `Will remove:\n${files}\n\nThis cannot be undone.`,
        btnConfirmDelete:     'Delete',
        btnCancel:            'Cancel',
        msgSaved:         'Saved.',
        msgDeleted:       (n) => `Deleted ${n} window(s).`,
        errCreate:        'Create failed',
        errLoad:          'Load failed',
        errSave:          'Save failed',
        errDelete:        'Delete failed',
    },
    zh: {
        tabNew:           '新建',
        tabEdit:          '编辑',
        tabDelete:        '删除',
        windowName:       '窗口名称（大驼峰）',
        windowNamePh:     'ShopWindow',
        prefabPath:       'Prefab 路径（resources/ 下）',
        layer:            '层级',
        stackable:        '可入栈',
        showMask:         '显示遮罩',
        maskClickClose:   '点遮罩关闭',
        blurBackground:   '模糊背景',
        destroyOnCovered: '覆盖后销毁',
        btnCreate:        '创建窗口',
        windowSelect:     '— 请选择 —',
        btnSave:          '保存属性',
        btnDelete:        '删除所选',
        windowNamesNote:  'WindowNames.ts — 已添加条目',
        indexNote:        'index.ts — 已添加 import',
        prefabNote:       'Prefab（在编辑器中手动创建）',
        errName:              '请输入窗口名称。',
        errSelect:            '请选择一个窗口。',
        errNoneSelected:      '请至少选择一个窗口。',
        confirmDeleteTitle:   (names) => `确定删除 ${names}？`,
        confirmDeleteDetail:  (files) => `将删除：\n${files}\n\n此操作不可撤销。`,
        btnConfirmDelete:     '删除',
        btnCancel:            '取消',
        msgSaved:         '保存成功。',
        msgDeleted:       (n) => `已删除 ${n} 个窗口。`,
        errCreate:        '创建失败',
        errLoad:          '加载失败',
        errSave:          '保存失败',
        errDelete:        '删除失败',
    },
};

function defaultPrefabPath(name) {
    return name ? `prefabs/ui/windows/${name}/${name}` : '';
}

function renderHTML(lang = 'en') {
    const t = I18N[lang] || I18N.en;
    const layerOptions = LAYERS.map((l) => `<option value="${l}">${l}</option>`).join('');
    return `
<style>
.wm-root { max-width: 520px; }
.wm-tabs { display: flex; gap: 4px; margin-bottom: 10px; }
.wm-tab { padding: 6px 12px; border: 1px solid var(--color-normal-border,#444); background: var(--color-normal-fill,#333); color: inherit; cursor: pointer; border-radius: 3px; }
.wm-tab-active { border-color: var(--color-focus-border-emphasis,#09f); background: var(--color-focus-fill-emphasis,#1a3a5c); }
.wm-status { min-height: 1.2em; margin: 0 0 8px; font-size: 11px; }
.wm-row { display: flex; flex-direction: column; gap: 4px; margin-bottom: 10px; }
.wm-row input, .wm-row select { padding: 4px 6px; }
.wm-row input[readonly] { opacity: 0.55; cursor: default; }
.wm-checks { display: flex; flex-direction: column; gap: 6px; margin-bottom: 12px; }
.wm-primary, .wm-danger { padding: 8px 14px; cursor: pointer; border-radius: 3px; border: 1px solid var(--color-normal-border,#444); background: var(--color-normal-fill,#333); color: inherit; }
.wm-danger { border-color: #844; background: #422; }
.wm-del-list { display: flex; flex-direction: column; gap: 4px; margin-bottom: 10px; max-height: 200px; overflow: auto; }
.wm-del-item { display: block; }
</style>
<div class="wm-root">
  <div class="wm-tabs">
    <button type="button" class="wm-tab wm-tab-active" data-tab="new">${t.tabNew}</button>
    <button type="button" class="wm-tab" data-tab="edit">${t.tabEdit}</button>
    <button type="button" class="wm-tab" data-tab="del">${t.tabDelete}</button>
  </div>
  <p class="wm-status" id="wm-status"></p>

  <!-- New -->
  <section class="wm-panel" data-panel="new">
    <label class="wm-row">${t.windowName}
      <input type="text" id="wm-new-name" placeholder="${t.windowNamePh}" />
    </label>
    <label class="wm-row">${t.prefabPath}
      <input type="text" id="wm-new-prefab" readonly />
    </label>
    <label class="wm-row">${t.layer}
      <select id="wm-new-layer">${layerOptions}</select>
    </label>
    <div class="wm-checks">
      <label><input type="checkbox" id="wm-new-stackable" checked /> ${t.stackable}</label>
      <label><input type="checkbox" id="wm-new-showmask" checked /> ${t.showMask}</label>
      <label><input type="checkbox" id="wm-new-maskclick" checked /> ${t.maskClickClose}</label>
      <label><input type="checkbox" id="wm-new-blur" /> ${t.blurBackground}</label>
      <label><input type="checkbox" id="wm-new-destroy" /> ${t.destroyOnCovered}</label>
    </div>
    <button type="button" class="wm-primary" id="wm-new-create">${t.btnCreate}</button>
  </section>

  <!-- Edit -->
  <section class="wm-panel" data-panel="edit" style="display:none">
    <label class="wm-row">${t.tabEdit}
      <select id="wm-edit-select"><option value="">${t.windowSelect}</option></select>
    </label>
    <label class="wm-row">${t.prefabPath}
      <input type="text" id="wm-edit-prefab" readonly />
    </label>
    <label class="wm-row">${t.layer}
      <select id="wm-edit-layer">${layerOptions}</select>
    </label>
    <div class="wm-checks">
      <label><input type="checkbox" id="wm-edit-stackable" /> ${t.stackable}</label>
      <label><input type="checkbox" id="wm-edit-showmask" /> ${t.showMask}</label>
      <label><input type="checkbox" id="wm-edit-maskclick" /> ${t.maskClickClose}</label>
      <label><input type="checkbox" id="wm-edit-blur" /> ${t.blurBackground}</label>
      <label><input type="checkbox" id="wm-edit-destroy" /> ${t.destroyOnCovered}</label>
    </div>
    <button type="button" class="wm-primary" id="wm-edit-save">${t.btnSave}</button>
  </section>

  <!-- Delete -->
  <section class="wm-panel" data-panel="del" style="display:none">
    <div id="wm-del-list" class="wm-del-list"></div>
    <button type="button" class="wm-danger" id="wm-del-btn">${t.btnDelete}</button>
  </section>
</div>
`;
}

function setStatus(root, msg, isErr) {
    const s = root.querySelector('#wm-status');
    if (!s) return;
    s.textContent = msg || '';
    s.style.color = isErr ? 'var(--color-error-fill,#f66)' : 'var(--color-success-fill,#8c8)';
}

function showCreateDialog(res, t) {
    const E = typeof Editor !== 'undefined' ? Editor : null;
    if (!E) return;
    const files = (res.created || []).map((f) => `✓ ${f}`).join('\n');
    const extra = `✓ ${t.windowNamesNote}\n✓ ${t.indexNote}`;
    const hint  = res.prefabHint ? `\n→ ${t.prefabNote}:\n  ${res.prefabHint}` : '';
    E.Dialog.info(`${files}\n${extra}${hint}`, { title: res.name, buttons: ['OK'] });
}

async function refreshWindowList(ipc, root, t) {
    const res = await ipc('scan-windows');
    if (!res || !res.ok) { setStatus(root, (res && res.error) || 'scan failed', true); return []; }
    const list = res.windows || [];
    const editSel = root.querySelector('#wm-edit-select');
    if (editSel) {
        const cur = editSel.value;
        editSel.innerHTML = `<option value="">${t.windowSelect}</option>`;
        list.forEach((w) => {
            const o = document.createElement('option');
            o.value = w; o.textContent = w;
            editSel.appendChild(o);
        });
        if (list.includes(cur)) editSel.value = cur;
    }
    const delList = root.querySelector('#wm-del-list');
    if (delList) {
        delList.innerHTML = list
            .map((w) => `<label class="wm-del-item"><input type="checkbox" class="wm-del-cb" value="${w}" /> ${w}</label>`)
            .join('');
    }
    return list;
}

function readNewPayload(root) {
    const name = root.querySelector('#wm-new-name').value.trim();
    return {
        name,
        prefabPath:       defaultPrefabPath(name),
        layer:            root.querySelector('#wm-new-layer').value,
        stackable:        root.querySelector('#wm-new-stackable').checked,
        showMask:         root.querySelector('#wm-new-showmask').checked,
        maskClickClose:   root.querySelector('#wm-new-maskclick').checked,
        blurBackground:   root.querySelector('#wm-new-blur').checked,
        destroyOnCovered: root.querySelector('#wm-new-destroy').checked,
    };
}

function applyAttrsToEdit(root, attrs, windowName) {
    root.querySelector('#wm-edit-prefab').value           = defaultPrefabPath(windowName);
    root.querySelector('#wm-edit-layer').value            = attrs.layer || 'Normal';
    root.querySelector('#wm-edit-stackable').checked      = !!attrs.stackable;
    root.querySelector('#wm-edit-showmask').checked       = !!attrs.showMask;
    root.querySelector('#wm-edit-maskclick').checked      = !!attrs.maskClickClose;
    root.querySelector('#wm-edit-blur').checked           = !!attrs.blurBackground;
    root.querySelector('#wm-edit-destroy').checked        = !!attrs.destroyOnCovered;
}

function readEditPayload(root) {
    const name = root.querySelector('#wm-edit-select').value;
    return {
        name,
        prefabPath:       defaultPrefabPath(name),
        layer:            root.querySelector('#wm-edit-layer').value,
        stackable:        root.querySelector('#wm-edit-stackable').checked,
        showMask:         root.querySelector('#wm-edit-showmask').checked,
        maskClickClose:   root.querySelector('#wm-edit-maskclick').checked,
        blurBackground:   root.querySelector('#wm-edit-blur').checked,
        destroyOnCovered: root.querySelector('#wm-edit-destroy').checked,
    };
}

function onMount(container, helpers) {
    const { ipc, lang = 'en' } = helpers;
    const t    = I18N[lang] || I18N.en;
    const root = container.querySelector('.wm-root') || container;
    const listeners = [];

    function on(target, ev, fn) {
        if (!target) return;
        target.addEventListener(ev, fn);
        listeners.push(() => target.removeEventListener(ev, fn));
    }

    // ── Tabs
    on(root, 'click', (e) => {
        const tab = e.target.closest('.wm-tab');
        if (!tab) return;
        const tabName = tab.getAttribute('data-tab');
        root.querySelectorAll('.wm-tab').forEach((tb) => tb.classList.remove('wm-tab-active'));
        tab.classList.add('wm-tab-active');
        root.querySelectorAll('.wm-panel').forEach((p) => {
            p.style.display = p.getAttribute('data-panel') === tabName ? 'block' : 'none';
        });
        setStatus(root, '');
        // 切回 New 时重置表单并还原焦点（setTimeout 避免 dialog 关闭后焦点竞争）
        if (tabName === 'new') {
            const inp = root.querySelector('#wm-new-name');
            if (inp) {
                inp.disabled = false;
                setTimeout(() => inp.focus(), 50);
            }
        }
    });

    // ── New: name → auto prefab path
    const newName   = root.querySelector('#wm-new-name');
    const newPrefab = root.querySelector('#wm-new-prefab');
    on(newName, 'input', () => { newPrefab.value = defaultPrefabPath(newName.value.trim()); });

    on(root.querySelector('#wm-new-create'), 'click', async () => {
        const payload = readNewPayload(root);
        if (!payload.name) { setStatus(root, t.errName, true); return; }
        const res = await ipc('create-window', payload);
        if (res && res.ok) {
            setStatus(root, '');
            newName.value = '';
            newPrefab.value = '';
            newName.focus();
            await refreshWindowList(ipc, root, t);
            showCreateDialog(res, t);
        } else {
            setStatus(root, `${t.errCreate}: ${(res && res.error) || ''}`, true);
        }
    });

    // ── Edit
    const editSel = root.querySelector('#wm-edit-select');
    on(editSel, 'change', async () => {
        const name = editSel.value;
        if (!name) return;
        const res = await ipc('read-window-attrs', { name });
        if (res && res.ok && res.attrs) {
            applyAttrsToEdit(root, res.attrs, name);
            setStatus(root, '');
        } else {
            setStatus(root, `${t.errLoad}: ${(res && res.error) || ''}`, true);
        }
    });
    on(root.querySelector('#wm-edit-save'), 'click', async () => {
        const payload = readEditPayload(root);
        if (!payload.name) { setStatus(root, t.errSelect, true); return; }
        const res = await ipc('edit-window', payload);
        if (res && res.ok) { setStatus(root, t.msgSaved); }
        else { setStatus(root, `${t.errSave}: ${(res && res.error) || ''}`, true); }
    });

    // ── Delete
    on(root.querySelector('#wm-del-btn'), 'click', async () => {
        const boxes = root.querySelectorAll('.wm-del-cb:checked');
        const names = Array.from(boxes).map((b) => b.value);
        if (names.length === 0) { setStatus(root, t.errNoneSelected, true); return; }
        const fileLines = names.flatMap((n) => [
            `  ui/windows/${n}/${n}Config.ts`,
            `  ui/windows/${n}/${n}Controller.ts`,
            `  ui/windows/${n}/${n}Data.ts`,
        ]).join('\n');

        // 使用 Editor.Dialog.warn 避免原生 confirm() 导致的焦点丢失问题
        const E = typeof Editor !== 'undefined' ? Editor : null;
        if (E) {
            const result = await E.Dialog.warn(t.confirmDeleteTitle(names.join(', ')), {
                detail:  t.confirmDeleteDetail(fileLines),
                buttons: [t.btnConfirmDelete, t.btnCancel],
                default: 1,
                cancel:  1,
            });
            if (result.response !== 0) return;
        }

        const res = await ipc('delete-windows', { names });
        if (res && res.ok) {
            setStatus(root, t.msgDeleted(res.deleted));
            await refreshWindowList(ipc, root, t);
        } else {
            setStatus(root, `${t.errDelete}: ${(res && res.error) || ''}`, true);
        }
    });

    refreshWindowList(ipc, root, t);
    return { unmount() { listeners.forEach((fn) => fn()); } };
}

module.exports = {
    section: 'UI Tools',
    label:   'Window Manager',
    renderHTML,
    onMount,
    onUnmount(handle) { if (handle && handle.unmount) handle.unmount(); },
};
