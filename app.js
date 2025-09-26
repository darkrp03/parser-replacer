import fs from "fs/promises";
import path from "path";
import { jsonrepair } from "jsonrepair";

const excludedFolders = [
    "node_modules",
    "dist",
    "services",
    "common",
    "config",
    "interfaces",
    "utils",
    "newspaper_images",
    "newspapers_files",
    "images",
    "shared",
    "helpers",
    "files",
    "logs",
    "refs",
    "object",
    "data"
];

const excludedFoldersInsideSurnames = [
    'parsers',
    'src',
    'parser'
]

async function getSubfolders(rootDir) {
    const folders = [];
    let content = await fs.readdir(rootDir);

    for (const obj of content) {
        const dirpath = path.join(rootDir, obj);
        const containsExcludedFolder = excludedFolders.some(folder => dirpath.includes(folder));

        if (containsExcludedFolder) {
            continue;
        }

        const stats = await fs.lstat(dirpath);

        if (!stats.isDirectory()) {
            continue;
        }

        folders.push(dirpath)
    }

    return folders;
}

async function getParserFolderContent(parserFolder) {
    const parserContent = [];
    let content = await fs.readdir(parserFolder);

    for (const file of content) {
        const fullFilePath = path.join(parserFolder, file);

        if (file.includes('parser') || file.includes('src')) {
            let subfiles = await fs.readdir(fullFilePath);
            subfiles = subfiles.map(subfile => path.join(fullFilePath, subfile));

            parserContent.push(...subfiles);

            continue;
        }

        parserContent.push(fullFilePath);
    }

    return parserContent;
}

async function getParsersFoldersFromSurname(surname) {
    const folders = [];
    const surnameFolders = await getSubfolders(surname);

    for (let folder of surnameFolders) {
        if (folder.includes('parsers') || folder.includes('src')) {
            const innerFolders = await getSubfolders(folder);
            folders.push(...innerFolders);

            continue;
        }

        folders.push(folder);
    }

    return folders;
}

async function safeReadFile(path, encoding = "utf-8") {
  try {
    const content = await fs.readFile(path, encoding);
    
    return content;
  } catch (err) {
    console.log(err)

    return null; 
  }
}

async function createConfigFiles(dir) {
    const objArr = await getDefaultConfigFile(dir);
    const obj = Array.isArray(objArr) ? objArr?.at(objArr.length - 1) : objArr;

    const brandFile = path.join(dir, 'brand.ts')
    const paramsFile = path.join(dir, 'params.ts')

    const emptyTemplate = `
export default {
    
}
`;

    const brandTemplate = obj ? `
export default {
    brandId: '${obj.brandId}',
    brandName: '${obj.brandName}',
    brandNameSlug: '${obj.brandNameSlug}'
}
` : emptyTemplate;

    await fs.writeFile(brandFile, brandTemplate.trimStart());
    await fs.writeFile(paramsFile, emptyTemplate.trimStart());
}

async function getDefaultConfigFile(dir) {
    const defaultFileTs = path.join(dir, 'default.ts');
    const defaultFileJs = path.join(dir, 'default.js');

    const code = await safeReadFile(defaultFileTs) || await safeReadFile(defaultFileJs);

    if (!code) {
        return null
    }

    let lines = code.split('\n');

    lines = lines
        // Remove require/import
        .filter(line => !line.includes('require') && !line.includes('import') && !line.includes('export default'))
        // Replace export statements with nothing
        .map(line => line.replace(/^\s*(const|let|var|module\.exports|export\s*=\s*|exports\s*=)\s*[^{]*{?/, '{'))
        // Remove JS expressions / template literals
        .map(line => line.replace(/`[^`]*`/g, '"PLACEHOLDER_PATH"'))
        .map(line => line.replace(/path\.resolve\([^)]*\)/g, '"PLACEHOLDER_PATH"'))
        // Remove semicolons
        .map(line => line.replace(/;\s*$/, ''))
        // Fix single quotes to double quotes
        .map(line => line.replace(/'([^']*)'/g, '"$1"'))
        // Quote keys
        .map(line => line.replace(/(\w+)\s*:/g, '"$1":'))
        // Fix malformed URLs
        .map(line => line.replace(/"https":\/\//g, 'https://'))
        // Remove any leading = signs
        .map(line => line.replace(/^\s*=\s*/, ''));
    
    const newCode = '{\n' + lines.join('\n') + '\n}';
    const obj = JSON.parse(jsonrepair(newCode));

    return obj;
}

function getOutputFilePath(file, outDir) {
    let splittedPath = file.split('/');

    splittedPath.shift();
    splittedPath.shift();
    splittedPath = splittedPath.filter(subpath => !excludedFoldersInsideSurnames.some(folder => subpath.includes(folder)))
    splittedPath.unshift(outDir);

    let newPath = splittedPath.join('/');

    return newPath;
}

async function main() {
    const rootDir = 'test';
    const outDir = 'dist';

    const surnames = (await getSubfolders(rootDir));

    for (const surname of surnames) {
        const parsersFolders = (await getParsersFoldersFromSurname(surname));

        for (const parserFolder of parsersFolders) {
            const files = await getParserFolderContent(parserFolder)

            for (const file of files) {
                const newFilePath = getOutputFilePath(file, outDir);

                await fs.cp(file, newFilePath, { recursive: true });

                if (newFilePath.includes('config')) {
                    await createConfigFiles(newFilePath)
                }
            }
        }
    }
}

main()