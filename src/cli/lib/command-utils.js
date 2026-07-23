export function getRootOpts(command) {
    let root = command;
    while (root.parent)
        root = root.parent;
    return root.opts() || {};
}
