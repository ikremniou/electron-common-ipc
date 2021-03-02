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
    while(i < arrFirstElemLength && arrFirstElem.charAt(i) === arrLastElem.charAt(i)) {
      ++i;
    }
    
    // Console log the substring of the first element of the array starting with
    // index zero and going all the way to just below index "i"
    return arrFirstElem.substring(0, i);
}

function CreateToDirs(libraryName, libraryOutdir) {
    const WorkspaceDir = 'C:\\kobra-local\\UniversalContainer\\dev';
    const DesktopFrameworkDir = WorkspaceDir;
    const EikonOnElectronDir = `${WorkspaceDir}\\src\\products\\eikon-on-electron`;

    const toDirs = [];
    toDirs.push(path.join(DesktopFrameworkDir, 'src', 'df-core', 'node_modules', libraryName));
    toDirs.push(path.join(DesktopFrameworkDir, 'src', 'df-core', 'build', 'src', 'node_modules', libraryName));
    toDirs.push(path.join(DesktopFrameworkDir, 'src', 'eikon-framework', 'node_modules', libraryName));
    toDirs.push(path.join(DesktopFrameworkDir, 'src', 'eikon-framework', 'build', 'src', 'node_modules', libraryName));
    toDirs.push(path.join(EikonOnElectronDir, 'node_modules', libraryName));
    return toDirs;
}

function CopyDir(fromDir, toDirs, libraryOutdir) {
    const commonDir = LongestCommonPrefix(toDirs);
    toDirs.forEach((topDir) => {
        console.log(`copying to \"${topDir.substr(commonDir.length)}\"`);
        try {
            if (fse.existsSync(topDir)) {
                fse.copySync(fromDir, path.join(topDir, libraryOutdir), {
                    overwrite : true,
                    preserveTimestamps : true
                });
                console.log(`done`);
            }
            else {
                console.warn(`targeted dir does not exist`);
            }
        }
        catch (err) {
            console.error(err.message);
        }
    });
}
{
    const fromDir = path.join(__dirname, '..', 'lib');
    const topDirs = CreateToDirs('electron-common-ipc');
    CopyDir(fromDir, topDirs, 'lib');
}

{
    const fromDir = path.join(__dirname, '..', 'node_modules', 'socket-serializer', 'lib');
    const topDirs = CreateToDirs('socket-serializer');
    CopyDir(fromDir, topDirs, 'lib');
}

{
    const fromDir = path.join(__dirname, '..', 'node_modules', 'json-helpers', 'lib');
    const topDirs = CreateToDirs('json-helpers', 'lib');
    CopyDir(fromDir, topDirs);
}