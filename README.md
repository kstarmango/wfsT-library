# wfs-Transaction
*See also https://github.com/kstarmango/wfsT-library*

## Usage

```
// 1. set GML option (it's shared below functions)
const t = new WfsTransaction(featureNS, featureType, srsName)

// 2. if single transact call
t.submitTransact(mode, feature, layerName)

// 2. if multi transact call

  // editedItems set 1. 
  t.setEditedItems(editItems)
  // editedItems set 2. 
  t.addEditedItems(mode, feature, layerName)

  // after setting
  t.submitMultiTransact()

  // if editedItems are written manually, 
  t.submitMultiTransact(editedItems_)

// 3. data cleanup
const res = t.setEditedItems();
if(res){
  cleanup();
}
```
## License
[MIT](LICENSE).
