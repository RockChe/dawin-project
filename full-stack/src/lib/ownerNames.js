// tasks.owner 是逗號分隔字串（varchar(500)）。改名同步只換「整個 token 完全相等」的項目，
// 保留順序與原本的分隔空白；"Amy Lin" 不會被 "Amy" 誤中。
export function replaceOwnerToken(owner, oldName, newName) {
  if (!owner) return owner;
  return owner
    .split(',')
    .map(tok => (tok.trim() === oldName ? tok.replace(oldName, () => newName) : tok))
    .join(',');
}

// config 'owners' 是 JSON 字串陣列。
export function replaceNameInList(list, oldName, newName) {
  return list.map(n => (n === oldName ? newName : n));
}
