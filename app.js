import fs from "fs/promises";
import path from "path";

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

function getOutputFilePath(file, outDir) {
    let splittedPath = file.split('/');

    splittedPath.shift();
    splittedPath = splittedPath.filter(subpath => !excludedFoldersInsideSurnames.some(folder => subpath.includes(folder)))
    splittedPath.unshift(outDir);

    let newPath = splittedPath.join('/');

    return newPath;
}

async function main() {
    const rootDir = '.';
    const outDir = '.';

    const surnames = (await getSubfolders(rootDir))
    for (const surname of surnames) {
        const parsersFolders = await getParsersFoldersFromSurname(surname);

        for (const parserFolder of parsersFolders) {
            const files = await getParserFolderContent(parserFolder);

            for (const file of files) {
                const newFilePath = getOutputFilePath(file, outDir);

                await fs.cp(file, newFilePath, { recursive: true });
            }
        }
    }
}

main()