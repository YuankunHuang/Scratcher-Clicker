'use strict';

const fs = require('fs');
const path = require('path');

const SCRIPTS_ROOT = path.join(__dirname, '../../assets/scripts');
const WINDOWS_ROOT = path.join(SCRIPTS_ROOT, 'ui/windows');
const WINDOW_NAMES_FILE = path.join(SCRIPTS_ROOT, 'ui/WindowNames.ts');
const INDEX_FILE = path.join(WINDOWS_ROOT, 'index.ts');

const NAME_RE = /^[A-Z][a-zA-Z0-9]*$/;

function windowDir(name) {
    return path.join(WINDOWS_ROOT, name);
}

function controllerPath(name) {
    return path.join(windowDir(name), `${name}Controller.ts`);
}

function readText(file) {
    return fs.readFileSync(file, 'utf8');
}

function writeText(file, content) {
    fs.writeFileSync(file, content, 'utf8');
}

function ensureScriptsRoot() {
    if (!fs.existsSync(SCRIPTS_ROOT)) {
        throw new Error(`Scripts root not found: ${SCRIPTS_ROOT}`);
    }
}

/**
 * @returns {string[]}
 */
function listWindowFolders() {
    ensureScriptsRoot();
    if (!fs.existsSync(WINDOWS_ROOT)) {
        return [];
    }
    const dirs = fs.readdirSync(WINDOWS_ROOT, { withFileTypes: true });
    const out = [];
    for (const d of dirs) {
        if (!d.isDirectory()) continue;
        const name = d.name;
        const ctrl = path.join(WINDOWS_ROOT, name, `${name}Controller.ts`);
        if (fs.existsSync(ctrl)) {
            out.push(name);
        }
    }
    out.sort();
    return out;
}

function buildConfigTs(name) {
    return `import { _decorator } from 'cc';
import { WindowConfig } from '../../base/WindowConfig';
const { ccclass } = _decorator;

@ccclass('${name}Config')
export class ${name}Config extends WindowConfig {}
`;
}

function buildDataTs(name) {
    return `export interface ${name}Data {}
`;
}

function formatDecoratorAttrs(attrs, windowName) {
    const prefabPath = attrs.prefabPath || `prefabs/ui/windows/${windowName}/${windowName}`;
    const layer = attrs.layer || 'Normal';
    return `{
    prefabPath: '${prefabPath.replace(/'/g, "\\'")}',
    layer: WindowLayer.${layer},
    stackable: ${attrs.stackable},
    showMask: ${attrs.showMask},
    maskClickClose: ${attrs.maskClickClose},
    isTransparent: ${attrs.isTransparent},
    blurBackground: ${attrs.blurBackground},
    destroyOnCovered: ${attrs.destroyOnCovered},
}`;
}

function buildControllerTs(name, attrs) {
    const merged = { ...attrs, prefabPath: attrs.prefabPath || `prefabs/ui/windows/${name}/${name}` };
    const dec = formatDecoratorAttrs(merged, name);
    return `import { WindowControllerBase } from "../../base/WindowControllerBase";
import { WindowNames } from "../../../ui/WindowNames";
import { windowController } from "../../../ui/registry/WindowRegistry";
import { WindowLayer } from "../../base/WindowAttributes";
import { ${name}Config } from "./${name}Config";
import { ${name}Data } from "./${name}Data";

@windowController(WindowNames.${name}, ${dec})
export class ${name}Controller extends WindowControllerBase<${name}Config, ${name}Data> {
    protected onInit(): void {}

    protected onPreShow(): void {}

    protected onShow(): void {}

    protected onPreHide(): void {}

    protected onHide(): void {}

    protected onDispose(): void {}
}
`;
}

function addWindowNamesEntry(name) {
    let content = readText(WINDOW_NAMES_FILE);
    const keyLine = `    ${name}: '${name}',`;
    if (content.includes(keyLine)) {
        return;
    }
    content = content.replace(/\}\s*as\s*const/, `${keyLine}\n} as const`);
    writeText(WINDOW_NAMES_FILE, content);
}

function removeWindowNamesEntry(name) {
    let content = readText(WINDOW_NAMES_FILE);
    const lineRe = new RegExp(`^\\s*${name}:\\s*'${name}',\\s*\\r?\\n`, 'm');
    content = content.replace(lineRe, '');
    writeText(WINDOW_NAMES_FILE, content);
}

function addIndexImport(name) {
    let content = readText(INDEX_FILE);
    const line = `import './${name}/${name}Controller';`;
    if (content.includes(line)) {
        return;
    }
    if (!content.endsWith('\n')) {
        content += '\n';
    }
    content += `${line}\n`;
    writeText(INDEX_FILE, content);
}

function removeIndexImport(name) {
    const content = readText(INDEX_FILE);
    const lines = content.split('\n').filter((line) => {
        const t = line.trim();
        return (
            t !== `import './${name}/${name}Controller';` &&
            t !== `// import './${name}/${name}Controller';`
        );
    });
    const out = lines.join('\n');
    writeText(INDEX_FILE, content.endsWith('\n') ? `${out}\n` : out);
}

/**
 * @param {object} attrs
 */
function createWindowFiles(attrs) {
    ensureScriptsRoot();
    const name = attrs.name;
    if (!NAME_RE.test(name)) {
        throw new Error('Window name must be PascalCase (e.g. ShopWindow).');
    }
    if (listWindowFolders().includes(name)) {
        throw new Error(`Window "${name}" already exists.`);
    }
    const dir = windowDir(name);
    fs.mkdirSync(dir, { recursive: true });

    const merged = {
        prefabPath: `prefabs/ui/windows/${name}/${name}`,
        layer: attrs.layer || 'Normal',
        stackable: !!attrs.stackable,
        showMask: !!attrs.showMask,
        maskClickClose: !!attrs.maskClickClose,
        isTransparent: !!attrs.isTransparent,
        blurBackground: !!attrs.blurBackground,
        destroyOnCovered: !!attrs.destroyOnCovered,
    };

    const rel = `ui/windows/${name}`;
    writeText(path.join(dir, `${name}Config.ts`),     buildConfigTs(name));
    writeText(path.join(dir, `${name}Data.ts`),       buildDataTs(name));
    writeText(path.join(dir, `${name}Controller.ts`), buildControllerTs(name, merged));

    addWindowNamesEntry(name);
    addIndexImport(name);

    // 通知 asset-db 立即扫描新目录，避免等待自动刷新周期
    Editor.Message.send('asset-db', 'refresh-asset', `db://assets/scripts/ui/windows/${name}/`);
    Editor.Message.send('asset-db', 'refresh-asset', 'db://assets/scripts/ui/WindowNames.ts');
    Editor.Message.send('asset-db', 'refresh-asset', 'db://assets/scripts/ui/windows/index.ts');

    return {
        ok: true,
        name,
        created: [
            `${rel}/${name}Config.ts`,
            `${rel}/${name}Controller.ts`,
            `${rel}/${name}Data.ts`,
        ],
        prefabHint: `resources/${merged.prefabPath}.prefab`,
    };
}

/**
 * @param {string[]} names
 */
function deleteWindowDirs(names) {
    ensureScriptsRoot();
    for (const name of names) {
        if (!NAME_RE.test(name)) {
            throw new Error(`Invalid window name: ${name}`);
        }
        const dir = windowDir(name);
        if (fs.existsSync(dir)) {
            fs.rmSync(dir, { recursive: true, force: true });
        }
        removeWindowNamesEntry(name);
        removeIndexImport(name);
        Editor.Message.send('asset-db', 'refresh-asset', 'db://assets/scripts/ui/windows/');
    }
    Editor.Message.send('asset-db', 'refresh-asset', 'db://assets/scripts/ui/WindowNames.ts');
    Editor.Message.send('asset-db', 'refresh-asset', 'db://assets/scripts/ui/windows/index.ts');
    return { ok: true, deleted: names.length };
}

function parseAttrsFromController(content) {
    const m = content.match(/@windowController\s*\(\s*WindowNames\.\w+\s*,\s*(\{[\s\S]*?\})\s*\)/);
    if (!m) {
        return null;
    }
    const block = m[1];
    const prefabPath = (block.match(/prefabPath:\s*['"]([^'"]+)['"]/) || [])[1] || '';
    const layer = (block.match(/layer:\s*WindowLayer\.(\w+)/) || [])[1] || 'Normal';
    const boolOr = (key, defaultVal) => {
        const mm = block.match(new RegExp(`${key}:\\s*(true|false)`));
        if (!mm) return defaultVal;
        return mm[1] === 'true';
    };
    return {
        prefabPath,
        layer,
        stackable: boolOr('stackable', true),
        showMask: boolOr('showMask', true),
        maskClickClose: boolOr('maskClickClose', true),
        isTransparent: boolOr('isTransparent', false),
        blurBackground: boolOr('blurBackground', false),
        destroyOnCovered: boolOr('destroyOnCovered', false),
    };
}

function readWindowAttrs(name) {
    ensureScriptsRoot();
    const p = controllerPath(name);
    if (!fs.existsSync(p)) {
        throw new Error(`Controller not found: ${p}`);
    }
    const content = readText(p);
    const attrs = parseAttrsFromController(content);
    if (!attrs) {
        throw new Error('Could not parse @windowController attributes.');
    }
    return { ok: true, name, attrs };
}

function editWindow(payload) {
    ensureScriptsRoot();
    const name = payload.name;
    if (!NAME_RE.test(name)) {
        throw new Error('Invalid window name.');
    }
    const p = controllerPath(name);
    if (!fs.existsSync(p)) {
        throw new Error(`Controller not found: ${name}`);
    }
    const merged = {
        prefabPath: payload.prefabPath || `prefabs/ui/windows/${name}/${name}`,
        layer: payload.layer || 'Normal',
        stackable: !!payload.stackable,
        showMask: !!payload.showMask,
        maskClickClose: !!payload.maskClickClose,
        isTransparent: !!payload.isTransparent,
        blurBackground: !!payload.blurBackground,
        destroyOnCovered: !!payload.destroyOnCovered,
    };
    let content = readText(p);
    const dec = formatDecoratorAttrs(merged, name);
    const replaced = content.replace(
        /@windowController\s*\(\s*WindowNames\.\w+\s*,\s*\{[\s\S]*?\}\s*\)/,
        `@windowController(WindowNames.${name}, ${dec})`,
    );
    if (replaced === content) {
        throw new Error('Failed to replace @windowController block.');
    }
    writeText(p, replaced);
    return { ok: true };
}

exports.methods = {
    openPanel() {
        Editor.Panel.open('toolbox.default');
    },

    scanWindows() {
        try {
            return { ok: true, windows: listWindowFolders() };
        } catch (e) {
            return { ok: false, error: e.message || String(e) };
        }
    },

    createWindow(payload) {
        try {
            return createWindowFiles(payload || {});
        } catch (e) {
            return { ok: false, error: e.message || String(e) };
        }
    },

    deleteWindows(payload) {
        try {
            const names = (payload && payload.names) || [];
            if (!Array.isArray(names) || names.length === 0) {
                throw new Error('No windows selected.');
            }
            return deleteWindowDirs(names);
        } catch (e) {
            return { ok: false, error: e.message || String(e) };
        }
    },

    readWindowAttrs(payload) {
        try {
            const name = payload && payload.name;
            if (!name) {
                throw new Error('Missing window name.');
            }
            return readWindowAttrs(name);
        } catch (e) {
            return { ok: false, error: e.message || String(e) };
        }
    },

    editWindow(payload) {
        try {
            if (!payload || !payload.name) {
                throw new Error('Missing payload.');
            }
            return editWindow(payload);
        } catch (e) {
            return { ok: false, error: e.message || String(e) };
        }
    },
};
