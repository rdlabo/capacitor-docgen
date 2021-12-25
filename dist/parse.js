"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.slugify = exports.parse = void 0;
const typescript_1 = __importDefault(require("typescript"));
const transpile_1 = require("./transpile");
const github_slugger_1 = __importDefault(require("github-slugger"));
const formatting_1 = require("./formatting");
/**
 * Given either a tsconfig file path, or exact input files, will
 * use TypeScript to parse apart the source file's JSDoc comments
 * and returns a function which can be used to get a specific
 * interface as the primary api. Used by the generate() function.
 */
function parse(opts) {
    const tsProgram = transpile_1.getTsProgram(opts);
    const typeChecker = tsProgram.getTypeChecker();
    const tsSourceFiles = tsProgram.getSourceFiles();
    const interfaces = [];
    const enums = [];
    const typeAliases = [];
    const pluginConfigs = [];
    tsSourceFiles.forEach((tsSourceFile) => {
        parseSourceFile(tsSourceFile, typeChecker, interfaces, typeAliases, enums, pluginConfigs);
    });
    return (api) => {
        let apiInterface = interfaces.find((i) => i.name === api) || null;
        /**
         * Add methods of import(many is used in `extends`)
         */
        const allImportObject = interfaces
            .filter((i) => (apiInterface === null || apiInterface === void 0 ? void 0 : apiInterface.importObject.includes(i.name)) && i.name !== api)
            .map((i) => i.importObject);
        const otherMethod = interfaces.filter((i) => [...new Set(allImportObject.flat())].includes(i.name)).map((d) => d.methods) || null;
        if (apiInterface !== null && otherMethod && otherMethod.length > 0) {
            apiInterface.methods = [...new Set(apiInterface === null || apiInterface === void 0 ? void 0 : apiInterface.methods.concat(otherMethod.flat(1)))];
        }
        const data = {
            api: apiInterface,
            interfaces: [],
            enums: [],
            typeAliases: [],
            pluginConfigs,
        };
        if (apiInterface) {
            collectInterfaces(data, apiInterface, interfaces, typeAliases, enums);
        }
        return data;
    };
}
exports.parse = parse;
function collectInterfaces(data, i, interfaces, typeAliases, enums) {
    var _a;
    if (i.name !== ((_a = data.api) === null || _a === void 0 ? void 0 : _a.name) && !data.interfaces.some((di) => di.name === i.name)) {
        const tags = i.tags.filter(tag => { var _a; return tag.name === 'extends' && ((_a = tag.text) === null || _a === void 0 ? void 0 : _a.trim()); }).map(tag => { var _a; return (_a = tag.text) === null || _a === void 0 ? void 0 : _a.trim(); });
        if (tags.length > 0) {
            const extendsInterfaces = interfaces.filter(i => [...new Set(tags)].includes(i.name)).map(i => i.properties);
            i.properties = i.properties.concat(extendsInterfaces.flat(1)).filter((elem, index, self) => {
                return self.indexOf(elem) === index;
            });
        }
        data.interfaces.push(i);
    }
    i.methods.forEach((m) => {
        collectUsed(data, m.complexTypes, interfaces, typeAliases, enums);
    });
    i.properties.forEach((p) => {
        collectUsed(data, p.complexTypes, interfaces, typeAliases, enums);
    });
}
function collectUsed(data, complexTypes, interfaces, typeAliases, enums) {
    complexTypes.forEach((typeName) => {
        const fi = interfaces.find((i) => i.name === typeName);
        if (fi && !data.interfaces.some((i) => i.name === fi.name)) {
            collectInterfaces(data, fi, interfaces, typeAliases, enums);
        }
        const ei = enums.find((en) => en.name === typeName);
        if (ei && !data.enums.some((en) => en.name === ei.name)) {
            data.enums.push(ei);
        }
        const ti = typeAliases.find((ty) => ty.name === typeName);
        if (ti && !data.typeAliases.some((ty) => ty.name === ti.name)) {
            data.typeAliases.push(ti);
            ti.types.forEach((type) => {
                collectUsed(data, type.complexTypes, interfaces, typeAliases, enums);
            });
        }
    });
}
function parseSourceFile(tsSourceFile, typeChecker, interfaces, typeAliases, enums, pluginConfigs) {
    const statements = tsSourceFile.statements;
    const interfaceDeclarations = statements.filter(typescript_1.default.isInterfaceDeclaration);
    const typeAliasDeclarations = statements.filter(typescript_1.default.isTypeAliasDeclaration);
    const enumDeclarations = statements.filter(typescript_1.default.isEnumDeclaration);
    const moduleDeclarations = statements.filter(typescript_1.default.isModuleDeclaration);
    interfaceDeclarations.forEach((interfaceDeclaration) => {
        interfaces.push(getInterface(typeChecker, interfaceDeclaration));
    });
    enumDeclarations.forEach((enumDeclaration) => {
        enums.push(getEnum(typeChecker, enumDeclaration));
    });
    typeAliasDeclarations.forEach((typeAliasDeclaration) => {
        typeAliases.push(getTypeAlias(typeChecker, typeAliasDeclaration));
    });
    moduleDeclarations
        .filter((m) => { var _a; return ((_a = m === null || m === void 0 ? void 0 : m.name) === null || _a === void 0 ? void 0 : _a.text) === '@capacitor/cli'; })
        .forEach((moduleDeclaration) => {
        getPluginsConfig(typeChecker, moduleDeclaration, pluginConfigs);
    });
}
function getInterface(typeChecker, node) {
    var _a, _b;
    const interfaceName = node.name.text;
    const methods = node.members.filter(typescript_1.default.isMethodSignature).reduce((methods, methodSignature) => {
        const m = getInterfaceMethod(typeChecker, methodSignature);
        if (m) {
            methods.push(m);
        }
        return methods;
    }, []);
    const properties = node.members.filter(typescript_1.default.isPropertySignature).reduce((properties, properytSignature) => {
        const p = getInterfaceProperty(typeChecker, properytSignature);
        if (p) {
            properties.push(p);
        }
        return properties;
    }, []);
    const symbol = typeChecker.getSymbolAtLocation(node.name);
    const docs = symbol ? serializeSymbol(typeChecker, symbol) : null;
    // @ts-ignore
    const importObject = ((_b = (_a = node.parent) === null || _a === void 0 ? void 0 : _a.locals) === null || _b === void 0 ? void 0 : _b.keys()) || [];
    const i = {
        name: interfaceName,
        slug: slugify(interfaceName),
        docs: (docs === null || docs === void 0 ? void 0 : docs.docs) || '',
        tags: (docs === null || docs === void 0 ? void 0 : docs.tags) || [],
        methods,
        properties,
        importObject: [...importObject].filter((d) => d !== interfaceName),
    };
    return i;
}
function getEnum(typeChecker, node) {
    const enumName = node.name.text;
    const en = {
        name: enumName,
        slug: slugify(enumName),
        members: node.members.map((enumMember) => {
            var _a;
            const symbol = typeChecker.getSymbolAtLocation(enumMember.name);
            const docs = symbol ? serializeSymbol(typeChecker, symbol) : null;
            const em = {
                name: enumMember.name.getText(),
                value: (_a = enumMember.initializer) === null || _a === void 0 ? void 0 : _a.getText(),
                tags: (docs === null || docs === void 0 ? void 0 : docs.tags) || [],
                docs: (docs === null || docs === void 0 ? void 0 : docs.docs) || '',
            };
            return em;
        }),
    };
    return en;
}
function getTypeAlias(typeChecker, node) {
    const symbol = typeChecker.getSymbolAtLocation(node.name);
    const docs = symbol ? serializeSymbol(typeChecker, symbol) : null;
    const typeAliasName = node.name.text;
    const typeAlias = {
        name: typeAliasName,
        slug: slugify(typeAliasName),
        docs: (docs === null || docs === void 0 ? void 0 : docs.docs) || '',
        types: [],
    };
    if (node.type) {
        if (typescript_1.default.isFunctionTypeNode(node.type)) {
            const signature = typeChecker.getSignatureFromDeclaration(node.type);
            if (signature) {
                const referencedTypes = new Set(getAllTypeReferences(node.type));
                referencedTypes.delete('Promise');
                const signatureString = typeChecker.signatureToString(signature);
                typeAlias.types = [
                    {
                        text: signatureString,
                        complexTypes: Array.from(referencedTypes),
                    },
                ];
            }
        }
        else if (typescript_1.default.isUnionTypeNode(node.type) && node.type.types) {
            typeAlias.types = node.type.types.map((t) => {
                const referencedTypes = new Set(getAllTypeReferences(t));
                referencedTypes.delete('Promise');
                const typeRef = {
                    text: t.getText(),
                    complexTypes: Array.from(referencedTypes),
                };
                return typeRef;
            });
        }
        else if (typeof node.type.getText === 'function') {
            const referencedTypes = new Set(getAllTypeReferences(node.type));
            referencedTypes.delete('Promise');
            typeAlias.types = [
                {
                    text: node.type.getText(),
                    complexTypes: Array.from(referencedTypes),
                },
            ];
        }
    }
    return typeAlias;
}
function getInterfaceMethod(typeChecker, methodSignature) {
    const flags = typescript_1.default.TypeFormatFlags.WriteArrowStyleSignature | typescript_1.default.TypeFormatFlags.NoTruncation;
    const signature = typeChecker.getSignatureFromDeclaration(methodSignature);
    if (!signature) {
        return null;
    }
    const tags = signature.getJsDocTags();
    if (tags.some((t) => t.name === 'hidden')) {
        return null;
    }
    const returnType = typeChecker.getReturnTypeOfSignature(signature);
    const returnTypeNode = typeChecker.typeToTypeNode(returnType, methodSignature, typescript_1.default.NodeBuilderFlags.NoTruncation | typescript_1.default.NodeBuilderFlags.NoTypeReduction);
    const returnString = typeToString(typeChecker, returnType);
    const signatureString = typeChecker.signatureToString(signature, methodSignature, flags, typescript_1.default.SignatureKind.Call);
    const referencedTypes = new Set([...getAllTypeReferences(returnTypeNode), ...getAllTypeReferences(methodSignature)]);
    referencedTypes.delete('Promise');
    const methodName = methodSignature.name.getText();
    const m = {
        name: methodName,
        signature: signatureString,
        parameters: signature.parameters.map((symbol) => {
            const doc = serializeSymbol(typeChecker, symbol);
            const type = typeChecker.getTypeAtLocation(symbol.valueDeclaration);
            const param = {
                name: symbol.name,
                docs: doc.docs,
                type: typeToString(typeChecker, type),
            };
            return param;
        }),
        returns: returnString,
        tags,
        docs: typescript_1.default.displayPartsToString(signature.getDocumentationComment(typeChecker)),
        complexTypes: Array.from(referencedTypes),
        slug: '',
    };
    m.slug = slugify(formatting_1.formatMethodSignatureForSlug(m));
    return m;
}
function getInterfaceProperty(typeChecker, properytSignature) {
    const symbol = typeChecker.getSymbolAtLocation(properytSignature.name);
    if (!symbol) {
        return null;
    }
    const type = typeChecker.getTypeAtLocation(properytSignature);
    const docs = serializeSymbol(typeChecker, symbol);
    const referencedTypes = new Set(getAllTypeReferences(properytSignature));
    referencedTypes.delete('Promise');
    const propName = properytSignature.name.getText();
    const p = {
        name: propName,
        tags: docs.tags,
        docs: docs.docs,
        complexTypes: Array.from(referencedTypes),
        type: typeToString(typeChecker, type, properytSignature.type),
    };
    return p;
}
function getPluginsConfig(typeChecker, moduleDeclaration, pluginConfigs) {
    const body = moduleDeclaration.body;
    if (!Array.isArray(body.statements)) {
        return;
    }
    const pluginConfigInterfaces = body.statements.filter((s) => { var _a; return ((_a = s === null || s === void 0 ? void 0 : s.name) === null || _a === void 0 ? void 0 : _a.text) === 'PluginsConfig' && Array.isArray(s === null || s === void 0 ? void 0 : s.members) && s.members.length > 0; });
    pluginConfigInterfaces.forEach((pluginConfigInterface) => {
        pluginConfigInterface.members
            .filter(typescript_1.default.isPropertySignature)
            .filter((p) => (p === null || p === void 0 ? void 0 : p.type) && (p === null || p === void 0 ? void 0 : p.type).members)
            .forEach((properytSignature) => {
            const typeLiteral = properytSignature.type;
            const nm = properytSignature.name.getText();
            const symbol = typeChecker.getSymbolAtLocation(properytSignature.name);
            const docs = symbol ? serializeSymbol(typeChecker, symbol) : null;
            const i = {
                name: nm,
                slug: slugify(nm),
                properties: typeLiteral.members
                    .filter(typescript_1.default.isPropertySignature)
                    .map((propertySignature) => {
                    return getInterfaceProperty(typeChecker, propertySignature);
                })
                    .filter((p) => p != null),
                docs: (docs === null || docs === void 0 ? void 0 : docs.docs) || '',
            };
            if (i.properties.length > 0) {
                pluginConfigs.push(i);
            }
        });
    });
}
function typeToString(checker, type, typeNode) {
    if (typeNode && typescript_1.default.isTypeReferenceNode(typeNode)) {
        return typeNode.getText();
    }
    const TYPE_FORMAT_FLAGS = typescript_1.default.TypeFormatFlags.NoTruncation |
        typescript_1.default.TypeFormatFlags.NoTypeReduction |
        typescript_1.default.TypeFormatFlags.WriteArrowStyleSignature |
        typescript_1.default.TypeFormatFlags.WriteTypeArgumentsOfSignature |
        typescript_1.default.TypeFormatFlags.UseSingleQuotesForStringLiteralType;
    return checker.typeToString(type, undefined, TYPE_FORMAT_FLAGS);
}
function serializeSymbol(checker, symbol) {
    if (!checker || !symbol) {
        return {
            tags: [],
            docs: '',
        };
    }
    return {
        tags: symbol.getJsDocTags().map((tag) => ({ text: tag.text, name: tag.name })),
        docs: typescript_1.default.displayPartsToString(symbol.getDocumentationComment(checker)),
    };
}
function getAllTypeReferences(node) {
    const referencedTypes = [];
    const visit = (node) => {
        if (typescript_1.default.isTypeReferenceNode(node)) {
            referencedTypes.push(getEntityName(node.typeName));
            if (node.typeArguments) {
                node.typeArguments.filter(typescript_1.default.isTypeReferenceNode).forEach((tr) => {
                    const typeName = tr.typeName;
                    if (typeName && typeName.escapedText) {
                        referencedTypes.push(typeName.escapedText.toString());
                    }
                });
            }
        }
        return typescript_1.default.forEachChild(node, visit);
    };
    if (node) {
        visit(node);
    }
    return referencedTypes;
}
function getEntityName(entity) {
    if (typescript_1.default.isIdentifier(entity)) {
        return entity.escapedText.toString();
    }
    else {
        return getEntityName(entity.left);
    }
}
function slugify(id) {
    const s = new github_slugger_1.default();
    return s.slug(id);
}
exports.slugify = slugify;
