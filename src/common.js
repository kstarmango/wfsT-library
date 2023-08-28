import { getUid } from 'ol/util';

export default class Common {

  getClonedFeatureProp(beforeFeature, modifiedFeature){
		// feature property setting when draw end  

		const uid = getUid(modifiedFeature);
		
		// const tempId = curLyr.get('layerName').concat("." + uid);
		modifiedFeature.setId(uid);

		const curLyrFeaturesProp = beforeFeature.getProperties();
		const copiedProp = {};
		
		for (const [key, value] of Object.entries(curLyrFeaturesProp)) {
			if(key.includes('id')){
				copiedProp[key] = 0;
			} else if(key !== 'geom' && key !== 'geometry') {
				copiedProp[key] = value;
			} 
		} 
		
		return copiedProp
	}

  checkType(features){
    for(let i in features){
      if(features[0].getGeometry().getType() !== features[i].getGeometry().getType()){
        return false
      }
    }
    return true 
  }

}