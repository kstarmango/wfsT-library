# Wfs-Editor
OpenLayers Feature Edit and Transaction Tools for Wfs Services




## Getting started

### Installation
To use the library in an application with an npm based dev environment, install it with
```
npm install @hyeokjin/wfs-editor
```


**@hyeokjin/wfs-editor requires <span style="color:red"> [OpenLayers](https://www.npmjs.com/package/ol), [ol-rotate-feature](https://www.npmjs.com/package/ol-rotate-feature), [@turf/turf](https://www.npmjs.com/package/@turf/turf), [jsts](https://www.npmjs.com/package/jsts)</span>**


## Usage


### wfsEditor setup


```
import { WfsEditor } from "@hyeokjin/wfs-transaction";

///after ol map create

const editor = new WfsEditor(map);

function eventTrigger(){
  editor.edit_function(arg...)
}

```

#### edit_functions


* **featureMove**: (`arg1` : `(e) => {}` , `arg2` :  `(e) => {}`) => `void`


* **rotate**: (`features` : `ol/Feature[]` , `arg1` :  `(e) => {}`, `arg2` :  `(e) => {}`) => `void`


* **lineStraight**: (`features` : `ol/Feature[]` ) => `void`


* **lineReverse**: (`feature` : `ol/Feature` ) => `void`


* **simplify**: (`feature` : `ol/Feature`, `option` : `tolerance options`) => `void`
[tolerance options](https://turfjs.org/docs/#simplify)


* **reflect**: (`feature` : `ol/Feature`, `axis` : `String`) => `void`


* **addMidPoint**: (`features` : `ol/Feature[]`, `source` : `ol/VectorSource`) => `addedFeature : ol/Feature`


* **merge**: (`features` : `ol/Feature[]`, `source` : `ol/VectorSource`) => `void`


* **split**: (`features` : `ol/Feature[]`, `source` : `ol/VectorSource`) => `splitFeatures : ol/Feature[]`


* **split**: (`features` : `ol/Feature[]`, `source` : `ol/VectorSource`) => `void`


* **crop**: (`feature` : `ol/Feature`, `source` : `ol/VectorSource`,  `arg1` :  `(e) => {}`, `arg2` :  `(e) => {}`) => `newFeatures : ol/Feature[]`


* **lineNodeSplit**: (`features` : `ol/Feature[]`, `source` : `ol/VectorSource`) => `addFeatures : ol/Feature[]`

---


### transaction
```
// 1. set GML option (it's shared below functions)
const t = new WfsTransaction(featureNS, featureType, srsName)

// 2. transact call
  // single
  t.submitTransact(mode, feature, layerName)

  // multi 
  // editedItems set 1. 
  t.setEditedItems(editItems)
  // editedItems set 2. 
  t.addEditedItems(mode, feature, layerName)

  // after setting
  t.submitMultiTransact()

  // if editedItems are written manually, 
  t.submitMultiTransact(editedItems_)

// 3. data cleanup
const res = await t.setEditedItems();
if(res){
  cleanup();
}
```


---


**if you need example, explore below link**


https://github.com/kstarmango/wfsT-library


https://github.com/mangosystem/ol-editor-wfst

## License
[MIT](LICENSE).
