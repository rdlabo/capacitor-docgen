"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.outputJson = exports.replaceMarkdownPlaceholders = exports.outputReadme = void 0;
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const formatting_1 = require("./formatting");
const util_1 = require("util");
const markdown_1 = require("./markdown");
const parse_1 = require("./parse");
const readFile = util_1.promisify(fs_1.default.readFile);
const writeFile = util_1.promisify(fs_1.default.writeFile);
const mkdir = util_1.promisify(fs_1.default.mkdir);
async function outputReadme(readmeFilePath, data) {
    if (typeof readmeFilePath !== 'string') {
        throw new Error(`Missing readme file path`);
    }
    if (!path_1.default.isAbsolute(readmeFilePath)) {
        throw new Error(`Readme file path must be an absolute path`);
    }
    let content;
    try {
        content = await readFile(readmeFilePath, 'utf8');
    }
    catch (e) {
        throw new Error(`Unable to read: "${readmeFilePath}".\n\nIf this is the correct path, please create the file first, then run again.`);
    }
    content = replaceMarkdownPlaceholders(content, data);
    await writeFile(readmeFilePath, content);
}
exports.outputReadme = outputReadme;
function replaceMarkdownPlaceholders(content, data) {
    if (typeof content !== 'string') {
        throw new Error(`Invalid content`);
    }
    if (data == null || data.api == null) {
        throw new Error(`Missing data`);
    }
    data = JSON.parse(JSON.stringify(data));
    content = replaceMarkdownDocsIndex(content, data);
    content = replaceMarkdownDocsConfig(content, data);
    content = replaceMarkdownDocsApi(content, data);
    return content;
}
exports.replaceMarkdownPlaceholders = replaceMarkdownPlaceholders;
const INDEX_START = `<docgen-index`;
const INDEX_END = `</docgen-index>`;
const API_START = `<docgen-api`;
const API_END = `</docgen-api>`;
const CONFIG_START = `<docgen-config`;
const CONFIG_END = `</docgen-config>`;
const UPDATE_MSG = `<!--Update the source file JSDoc comments and rerun docgen to update the docs below-->`;
function replaceMarkdownDocsIndex(content, data) {
    const startOuterIndex = content.indexOf(INDEX_START);
    if (startOuterIndex > -1) {
        const endInnerIndex = content.indexOf(INDEX_END);
        if (endInnerIndex > -1) {
            const inner = content.substring(startOuterIndex + INDEX_START.length);
            const startInnderIndex = startOuterIndex + INDEX_START.length + inner.indexOf('>') + 1;
            const start = content.substring(0, startInnderIndex);
            const end = content.substring(endInnerIndex);
            return `${start}\n\n${markdownIndex(data)}\n\n${end}`;
        }
    }
    return content;
}
function replaceMarkdownDocsConfig(content, data) {
    const startOuterIndex = content.indexOf(CONFIG_START);
    if (startOuterIndex > -1) {
        const endInnerIndex = content.indexOf(CONFIG_END);
        if (endInnerIndex > -1) {
            const inner = content.substring(startOuterIndex + CONFIG_START.length);
            const startInnerIndex = startOuterIndex + CONFIG_START.length + inner.indexOf('>') + 1;
            const start = content.substring(0, startInnerIndex);
            const end = content.substring(endInnerIndex);
            return `${start}\n${UPDATE_MSG}\n\n${markdownConfig(data)}\n\n${end}`;
        }
    }
    return content;
}
function replaceMarkdownDocsApi(content, data) {
    const startOuterIndex = content.indexOf(API_START);
    if (startOuterIndex > -1) {
        const endInnerIndex = content.indexOf(API_END);
        if (endInnerIndex > -1) {
            const inner = content.substring(startOuterIndex + API_START.length);
            const startInnerIndex = startOuterIndex + API_START.length + inner.indexOf('>') + 1;
            const start = content.substring(0, startInnerIndex);
            const end = content.substring(endInnerIndex);
            return `${start}\n${UPDATE_MSG}\n\n${markdownApi(data)}\n\n${end}`;
        }
    }
    return content;
}
function markdownIndex(data) {
    var _a;
    const o = [];
    (_a = data === null || data === void 0 ? void 0 : data.api) === null || _a === void 0 ? void 0 : _a.methods.forEach(m => {
        o.push(`* [\`${formatting_1.formatMethodSignature(m)}\`](#${m.slug})`);
    });
    if (data.interfaces.length > 0) {
        o.push(`* [Interfaces](#${parse_1.slugify('Interfaces')})`);
    }
    if (data.typeAliases.length > 0) {
        o.push(`* [Type Aliases](#${parse_1.slugify('Type Aliases')})`);
    }
    if (data.enums.length > 0) {
        o.push(`* [Enums](#${parse_1.slugify('Enums')})`);
    }
    return o.join('\n').trim();
}
function markdownApi(data) {
    var _a;
    const o = [];
    if (typeof ((_a = data.api) === null || _a === void 0 ? void 0 : _a.docs) === 'string' && data.api.docs.length > 0) {
        o.push(data.api.docs);
        o.push(``);
    }
    data.api.methods.forEach(m => {
        o.push(methodsTable(data, m));
    });
    if (data.interfaces.length > 0) {
        o.push(`### Interfaces`);
        o.push(``);
        data.interfaces.forEach(i => {
            o.push(interfaceTable(data, i));
        });
        o.push(``);
    }
    if (data.typeAliases.length > 0) {
        o.push(`### Type Aliases`);
        o.push(``);
        data.typeAliases.forEach(i => {
            o.push(typeAliasTable(data, i));
        });
        o.push(``);
    }
    if (data.enums.length > 0) {
        o.push(`### Enums`);
        o.push(``);
        data.enums.forEach(i => {
            o.push(enumTable(data, i));
        });
        o.push(``);
    }
    return o.join('\n').trim();
}
function methodsTable(data, m) {
    const o = [];
    o.push(`### ${formatting_1.formatMethodSignature(m)}`);
    o.push(``);
    o.push('```typescript');
    o.push(`${m.name}${m.signature}`);
    o.push('```');
    o.push(``);
    if (m.docs) {
        o.push(formatting_1.formatDescription(data, m.docs));
        o.push(``);
    }
    if (m.parameters.length > 0) {
        o.push(...createMethodParamTable(data, m.parameters));
        o.push(``);
    }
    const ret = formatting_1.formatType(data, m.returns);
    if (ret.type !== 'void' && ret.type !== 'Promise<void>') {
        o.push(`**Returns:** ${ret.formatted}`);
        o.push(``);
    }
    const since = getTagText(m.tags, 'since');
    if (since) {
        o.push(`**Since:** ${since}`);
        o.push(``);
    }
    o.push(`--------------------`);
    o.push(``);
    o.push(``);
    return o.join('\n');
}
function markdownConfig(data) {
    const o = [];
    if (data.pluginConfigs) {
        data.pluginConfigs.forEach(c => {
            o.push(configInterfaceTable(data, c));
            o.push(buildExamples(c));
        });
    }
    return o.join('\n');
}
function buildExamples(c) {
    const o = [];
    o.push(`### Examples`);
    o.push(``);
    o.push(`In \`capacitor.config.json\`:`);
    o.push(``);
    o.push(`\`\`\`json`);
    o.push(`{`);
    o.push(`  "plugins": {`);
    o.push(`    "${c.name}": {`);
    c.properties.forEach((p, i) => {
        var _a;
        o.push(`      "${p.name}": ${(_a = p.tags.find(t => t.name === 'example')) === null || _a === void 0 ? void 0 : _a.text}${i === c.properties.length - 1 ? '' : ','}`);
    });
    o.push(`    }`);
    o.push(`  }`);
    o.push(`}`);
    o.push(`\`\`\``);
    o.push(``);
    o.push(`In \`capacitor.config.ts\`:`);
    o.push(``);
    o.push(`\`\`\`ts`);
    o.push(`/// <reference types="@capacitor/${parse_1.slugify(c.name.replace(/([a-z])([A-Z])/g, '$1 $2'))}" />`);
    o.push(``);
    o.push(`import { CapacitorConfig } from '@capacitor/cli';`);
    o.push(``);
    o.push(`const config: CapacitorConfig = {`);
    o.push(`  plugins: {`);
    o.push(`    ${c.name}: {`);
    c.properties.forEach(p => {
        var _a;
        o.push(`      ${p.name}: ${(_a = p.tags.find(t => t.name === 'example')) === null || _a === void 0 ? void 0 : _a.text},`);
    });
    o.push(`    },`);
    o.push(`  },`);
    o.push(`};`);
    o.push(``);
    o.push(`export = config;`);
    o.push(`\`\`\``);
    return o.join('\n');
}
function createMethodParamTable(data, parameters) {
    const t = new markdown_1.MarkdownTable();
    t.addHeader([`Param`, `Type`, `Description`]);
    parameters.forEach(p => {
        const nm = `**\`${p.name}\`**`;
        const ty = formatting_1.formatType(data, p.type);
        const docs = formatting_1.formatDescription(data, p.docs);
        t.addRow([nm, ty.formatted, docs]);
    });
    t.removeEmptyColumns();
    return t.toMarkdown();
}
function interfaceTable(data, i) {
    const o = [];
    o.push(``);
    o.push(`#### ${i.name}`);
    o.push(``);
    if (i.docs) {
        o.push(`${formatting_1.formatDescription(data, i.docs)}`);
        o.push(``);
    }
    if (i.properties.length > 0) {
        const t = new markdown_1.MarkdownTable();
        t.addHeader([`Prop`, `Type`, `Description`, `Default`, `Since`]);
        i.properties.forEach(m => {
            const defaultValue = getTagText(m.tags, 'default');
            t.addRow([
                `**\`${m.name}\`**`,
                formatting_1.formatType(data, m.type).formatted,
                formatting_1.formatDescription(data, m.docs),
                defaultValue ? `<code>${defaultValue}</code>` : '',
                getTagText(m.tags, 'since'),
            ]);
        });
        t.removeEmptyColumns();
        o.push(...t.toMarkdown());
        o.push(``);
    }
    if (i.methods.length > 0) {
        const t = new markdown_1.MarkdownTable();
        t.addHeader([`Method`, `Signature`, `Description`]);
        i.methods.forEach(m => {
            t.addRow([
                `**${m.name}**`,
                formatting_1.formatDescription(data, m.signature),
                formatting_1.formatDescription(data, m.docs),
            ]);
        });
        t.removeEmptyColumns();
        o.push(...t.toMarkdown());
        o.push(``);
    }
    return o.join(`\n`);
}
function configInterfaceTable(data, i) {
    const o = [];
    if (i.docs) {
        o.push(`${formatting_1.formatDescription(data, i.docs)}`);
        o.push(``);
    }
    if (i.properties.length > 0) {
        const t = new markdown_1.MarkdownTable();
        t.addHeader([`Prop`, `Type`, `Description`, `Default`, `Since`]);
        i.properties.forEach(m => {
            const defaultValue = getTagText(m.tags, 'default');
            t.addRow([
                `**\`${m.name}\`**`,
                formatting_1.formatType(data, m.type).formatted,
                formatting_1.formatDescription(data, m.docs),
                defaultValue ? `<code>${defaultValue}</code>` : '',
                getTagText(m.tags, 'since'),
            ]);
        });
        t.removeEmptyColumns();
        o.push(...t.toMarkdown());
        o.push(``);
    }
    return o.join(`\n`);
}
function typeAliasTable(data, t) {
    const o = [];
    o.push(``);
    o.push(`#### ${t.name}`);
    o.push(``);
    if (t.docs) {
        o.push(formatting_1.formatDescription(data, t.docs));
        o.push(``);
    }
    const type = t.types
        .map(ty => formatting_1.formatType(data, ty.text).formatted)
        .join(' | ')
        .replace(/\<\/code\> \| \<code\>/g, ` | `);
    o.push(`${type}`);
    o.push(``);
    return o.join(`\n`);
}
function enumTable(data, i) {
    const o = [];
    o.push(``);
    o.push(`#### ${i.name}`);
    o.push(``);
    if (i.members.length > 0) {
        const t = new markdown_1.MarkdownTable();
        t.addHeader([`Members`, `Value`, `Description`, `Since`]);
        i.members.forEach(m => {
            t.addRow([
                `**\`${m.name}\`**`,
                formatting_1.formatType(data, m.value).formatted,
                formatting_1.formatDescription(data, m.docs),
                getTagText(m.tags, 'since'),
            ]);
        });
        t.removeEmptyColumns();
        o.push(...t.toMarkdown());
        o.push(``);
    }
    return o.join(`\n`);
}
function getTagText(tags, tagName) {
    if (tags) {
        const tag = tags.find(t => t.name === tagName && typeof t.text === 'string');
        if (tag) {
            return tag.text;
        }
    }
    return '';
}
async function outputJson(jsonFilePath, data) {
    if (typeof jsonFilePath !== 'string') {
        throw new Error(`Missing json file path`);
    }
    if (!path_1.default.isAbsolute(jsonFilePath)) {
        throw new Error(`JSON file path must be an absolute path`);
    }
    if (data == null) {
        throw new Error(`Missing data`);
    }
    const content = JSON.stringify(data, null, 2);
    await mkdir(path_1.default.dirname(jsonFilePath), { recursive: true });
    await writeFile(jsonFilePath, content);
}
exports.outputJson = outputJson;
