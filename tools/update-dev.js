const path = require('path');
// https://github.com/pillys/copy-dir
const fse = require('fs-extra');

function LongestCommonPrefix(arr) {
    // sort() method arranges array elements alphabetically
    const sortArr = arr.sort();

    // Get first array element
    const arrFirstElem = arr[0];

    // Get the last array element length minus one
    const arrLastElem = sortArr[sortArr.length - 1];

    // Get first array element length
    const arrFirstElemLength = arrFirstElem.length;

    // while "i" is less than the length of the first array element AND
    // the first array element character position matches the last array character position
    // increment "i" by one
    let i = 0;
    while (i < arrFirstElemLength && arrFirstElem.charAt(i) === arrLastElem.charAt(i)) {
        ++i;
    }

    // Console log the substring of the first element of the array starting with
    // index zero and going all the way to just below index "i"
    return arrFirstElem.substring(0, i);
}

function CreateToDirs() {
    const WorkspaceDir = 'C:\\kobra-local\\UniversalContainer\\dev';
    const DesktopFrameworkDir = WorkspaceDir;
    const EikonOnElectronDir = `${WorkspaceDir}\\src\\products\\eikon-on-electron`;

    const toDirs = [];
    toDirs.push(path.join(DesktopFrameworkDir, 'src', 'df-core', 'node_modules'));
    toDirs.push(path.join(DesktopFrameworkDir, 'src', 'df-core', 'build', 'src', 'node_modules'));
    toDirs.push(path.join(DesktopFrameworkDir, 'src', 'eikon-framework', 'node_modules'));
    toDirs.push(path.join(DesktopFrameworkDir, 'src', 'eikon-framework', 'build', 'src', 'node_modules'));
    toDirs.push(path.join(DesktopFrameworkDir, 'workspace', 'build', 'app', 'node_modules'));
    toDirs.push(path.join(EikonOnElectronDir, 'node_modules'));
    return toDirs;
}

function CopyDir(libraryName, fromDir, toDirs) {
    const package_json_filename = path.join(fromDir, libraryName, 'package.json');
    const package_json = fse.readJSONSync(package_json_filename);
    const libraryOutdir = path.dirname(package_json.main);
    const commonDir = LongestCommonPrefix(toDirs);
    toDirs.forEach((topDir) => {
        console.log(`copying to ${libraryName} to \"${topDir.substr(commonDir.length)}\"`);
        if (fse.existsSync(path.join(topDir, libraryName))) {
            try {
                fse.copyFileSync(package_json_filename, path.join(topDir, libraryName, 'package.json'));
            }
            catch (err) {
                console.error(err.message);
            }
            try {
                fse.copySync(path.join(fromDir, libraryName, libraryOutdir), path.join(topDir, libraryName, libraryOutdir), {
                    overwrite: true,
                    preserveTimestamps: true
                });
            }
            catch (err) {
                console.error(err.message);
            }
            console.log(`done`);
        }
        else {
            console.warn(`targeted dir does not exist`);
        }
    });
}

const topDirs = CreateToDirs();
{
    const fromDir = path.join(__dirname, '..', '..');
    CopyDir('electron-common-ipc', fromDir, topDirs);
}
{
    const fromDir = path.join(__dirname, '..', 'node_modules');
    CopyDir('socket-serializer', fromDir, topDirs);
}

{
    const fromDir = path.join(__dirname, '..', 'node_modules');
    CopyDir('json-helpers', fromDir, topDirs);
}