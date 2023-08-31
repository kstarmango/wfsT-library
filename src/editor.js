/** 
Create wfs-transaction call for OpenLayers

@module mango/wfs-transform
@author Hyeokjin Kim <kstarmango@gmail.com>
@version 0.1.4
@license MIT
@copyright (c) MangoSystem
*/

import { getLength } from 'ol/sphere';
import VectorSource from 'ol/source/Vector';
import Feature from 'ol/Feature';
import GeoJSON from 'ol/format/GeoJSON';
import RotateFeatureInteraction from 'ol-rotate-feature';
import {
	Point,
	LineString,
	MultiLineString,
	MultiPoint,
	MultiPolygon,
} from 'ol/geom';
import { 
  Translate, 
  Draw, 
  Select 
} from 'ol/interaction';

import { GeoJSONWriter, GeoJSONReader } from 'jsts/org/locationtech/jts/io';
import { AffineTransformation } from 'jsts/org/locationtech/jts/geom/util';
import MinimumDiameter from 'jsts/org/locationtech/jts/algorithm/MinimumDiameter';
import LineSegment from 'jsts/org/locationtech/jts/geom/LineSegment';
import DistanceOp from 'jsts/org/locationtech/jts/operation/distance/DistanceOp';
import UnionOp from 'jsts/org/locationtech/jts/operation/union/UnionOp';
import Polygonizer from 'jsts/org/locationtech/jts/operation/polygonize/Polygonizer';
import { LineMerger } from 'jsts/org/locationtech/jts/operation/linemerge';

import { centroid, lineSplit, simplify } from '@turf/turf';

import Common from './common';

export default class WfsEditor extends Common {

	constructor(map) {
		super();

    this.map = map;
	}

	/** 
	 * @purpose 피쳐 이동
	 */
	featureMove(l1 = (e) => {}, l2 = (e) => {}) {

		this.map.getInteractions().forEach(function (interaction) {
			if (interaction instanceof Translate) {
				this.map.removeInteraction(interaction);
			}
		});

		this._translate = new Translate();

		if (!this._translate || !this.map) return console.log('no Map');

		this.map.addInteraction(this._translate);

		this._translate.on('translatestart', (e) => l1(e));

		this._translate.on('translateend', (e) => {
			this.map.removeInteraction(this._translate);
			l2(e);
		});
	}

	/** 
	 * @purpose 피쳐 회전
	 */
	rotate(features = [Feature], style, l1 = (e) => {}, l2 = (e) => {}) {
		const featureGeom = {
			type: features[0].getGeometry().getType(),
			coordinates: features[0].getGeometry().getCoordinates(),
		};

		const centroidPoint = centroid(featureGeom);

		const createDefaultRotateStyle = () => {
			let styles = {
				anchor: [],
				arrow: [],
			};

			return function (feature, resolution) {
				let style;
				let angle = feature.get('angle') || 0;
				switch (true) {
					case feature.get('rotate-anchor'):
						style = styles['anchor'];
						return style;
					case feature.get('rotate-arrow'):
						style = styles['arrow'];
						return style;
					default:
						break;
				}
			};
		};

		const rotate = new RotateFeatureInteraction({
			features: features,
			anchor: centroidPoint.geometry.coordinates,
			angle: (-90 * Math.PI) / 180,
			style: style !== null ? style : createDefaultRotateStyle(),
		});

		this.map.addInteraction(rotate);

		rotate.on('rotatestart', l1);
		rotate.on('rotateend', l2);
	}

	/** 
	 * @purpose 라인 단순화
	 */
	lineStraight(feature = Feature) {
		const geom = feature.getGeometry();

		// multi LineString
		if (feature.getGeometry().getType().indexOf('Multi') !== -1) {
			let newGeom = new Array();

			for (let i = 0; i < geom.getCoordinates().length; i++) {
				newGeom.push([
					geom.getCoordinates()[i][0],
					geom.getCoordinates()[i][geom.getCoordinates()[i].length - 1],
				]);
			}
			geom.setCoordinates(newGeom);

			//single LineString
		} else {
			const newGeom = [
				geom.getCoordinates()[0],
				geom.getCoordinates()[geom.getCoordinates().length - 1],
			];

			geom.setCoordinates(newGeom);
		}

		feature.setGeometry(geom);
	}

	/** 
	 * @purpose 라인 방향반전 => coordinate 변경
	 */
	lineReverse(feature = Feature) {
		const geom = feature.getGeometry();

		//multi
		if (feature.getGeometry().getType().indexOf('Multi') !== -1) {
			let newGeom = new Array();
			for (let i = 0; i < geom.getCoordinates().length; i++) {
				newGeom.push(geom.getCoordinates()[i].reverse());
			}
			geom.setCoordinates(newGeom);
		}

		//single
		if (feature.getGeometry().getType().indexOf('Multi') === -1) {
			const newGeom = geom.getCoordinates().reverse();
			geom.setCoordinates(newGeom);
		}

		feature.setGeometry(geom);
	}

	/** 
	 * @purpose 폴리곤, 라인 단순화 => turf.js 활용(simplify)
	 */
	simplify(feature = Feature, option) {
		const featureGeom = {
			type: feature.getGeometry().getType(),
			coordinates: feature.getGeometry().getCoordinates(),
		};

		// tolerance options
		// percentage (ex) 아래의 0.05 * length를 하여 길이를 구하여 입력)
		// meter (ex) meter 값 입력)
		const length = getLength(feature.getGeometry());
		const tolerance_ = length * 0.05;

		const options = option
			? option
			: { tolerance: tolerance_, highQuality: false, mutate: false };

		const simplified = simplify(featureGeom, options);

		const geoJson = new GeoJSON();
		const geom = geoJson.readGeometry(simplified);

		feature.setGeometry(geom);
	}

	/** 
	 * @purpose 짧은 축, 긴축 기준 뒤집기
   * @param axis 'short or long' 
	 */
	reflect(feature = Feature, axis = '') {
		const beforeFeature = feature.clone();

		const featureGeom = {
			type: feature.getGeometry().getType(),
			coordinates: feature.getGeometry().getCoordinates(),
		};

		const reader = new GeoJSONReader();
		const geoJson = new GeoJSON();
		const writer = new GeoJSONWriter();
		const affine = new AffineTransformation();

		const minimumDia = new MinimumDiameter(reader.read(featureGeom), false);
		let minimumRec = minimumDia.getMinimumRectangle();
		if (minimumDia.getMinimumRectangle().getCoordinates().length > 2) {
			const point1 = reader.read({
				type: 'Point',
				coordinates: [
					minimumRec.getCoordinates()[0].x,
					minimumRec.getCoordinates()[0].y,
				],
			});
			const point2 = reader.read({
				type: 'Point',
				coordinates: [
					minimumRec.getCoordinates()[1].x,
					minimumRec.getCoordinates()[1].y,
				],
			});
			const point3 = reader.read({
				type: 'Point',
				coordinates: [
					minimumRec.getCoordinates()[2].x,
					minimumRec.getCoordinates()[2].y,
				],
			});
			const point4 = reader.read({
				type: 'Point',
				coordinates: [
					minimumRec.getCoordinates()[3].x,
					minimumRec.getCoordinates()[3].y,
				],
			});

			let midpoint1 = new LineSegment(
				point1.getCoordinates()[0],
				point2.getCoordinates()[0]
			).midPoint();
			let midpoint2 = new LineSegment(
				point2.getCoordinates()[0],
				point3.getCoordinates()[0]
			).midPoint();
			let midpoint3 = new LineSegment(
				point3.getCoordinates()[0],
				point4.getCoordinates()[0]
			).midPoint();
			let midpoint4 = new LineSegment(
				point4.getCoordinates()[0],
				point1.getCoordinates()[0]
			).midPoint();

			let resultPoint1 = reader.read({
				type: 'Point',
				coordinates: [midpoint1.x, midpoint1.y],
			});
			let resultPoint2 = reader.read({
				type: 'Point',
				coordinates: [midpoint2.x, midpoint2.y],
			});
			let resultPoint3 = reader.read({
				type: 'Point',
				coordinates: [midpoint3.x, midpoint3.y],
			});
			let resultPoint4 = reader.read({
				type: 'Point',
				coordinates: [midpoint4.x, midpoint4.y],
			});

			let distance1 = new DistanceOp(resultPoint1, resultPoint3).distance();
			let distance2 = new DistanceOp(resultPoint2, resultPoint4).distance();

			let shortAxis;
			let longAxis;
			if (distance1 > distance2) {
				longAxis = [
					resultPoint1.getCoordinates()[0].x,
					resultPoint1.getCoordinates()[0].y,
					resultPoint3.getCoordinates()[0].x,
					resultPoint3.getCoordinates()[0].y,
				];
				shortAxis = [
					resultPoint2.getCoordinates()[0].x,
					resultPoint2.getCoordinates()[0].y,
					resultPoint4.getCoordinates()[0].x,
					resultPoint4.getCoordinates()[0].y,
				];
			} else {
				longAxis = [
					resultPoint2.getCoordinates()[0].x,
					resultPoint2.getCoordinates()[0].y,
					resultPoint4.getCoordinates()[0].x,
					resultPoint4.getCoordinates()[0].y,
				];
				shortAxis = [
					resultPoint1.getCoordinates()[0].x,
					resultPoint1.getCoordinates()[0].y,
					resultPoint3.getCoordinates()[0].x,
					resultPoint3.getCoordinates()[0].y,
				];
			}

			if (axis === 'short') {
				affine.reflect(shortAxis[0], shortAxis[1], shortAxis[2], shortAxis[3]);
			} else if (axis === 'long') {
				affine.reflect(longAxis[0], longAxis[1], longAxis[2], longAxis[3]);
			}

			const affineGeom = affine.transform(reader.read(featureGeom));
			const affineGeoJson = geoJson.readGeometry(writer.write(affineGeom));
			feature.setGeometry(affineGeoJson);

		}
	}

	/** 
	 * @purpose 다중 포인트 중심점 생성 (포인트들의 가운데 지점으로 병합)
	 */
	midPointAdd(features = [Feature], source = VectorSource) {
		let coords = [];
    let modifiedFeature;

		if (this.checkType(features)) {
			if (features[0].getGeometry().getType() === 'Point') {
				let type = '';

				for (let item of features) {
					coords.push(item.getGeometry().getCoordinates());
					source.removeFeature(item);
				}

				if (features.length > 2) {
					type = 'Polygon';
					coords.push(coords[0]);
					coords = [coords];
				} else {
					type = 'LineString';
				}

				// 중심점을 구하기 위한 geometry
				const featureGeom = {
					type: type,
					coordinates: coords,
				};

				let centroidPoint = centroid(featureGeom);
				modifiedFeature = new Feature(
					new Point(centroidPoint.geometry.coordinates)
				);

				const featureProp = this.getClonedFeatureProp(
					features[0],
					modifiedFeature
				);
				modifiedFeature.setProperties(featureProp);

				source.addFeature(modifiedFeature);
			} else if (features[0].getGeometry().getType() === 'MultiPoint') {
				// MultiPoint 좌표 병합
				for (let i = features.length - 1; i >= 0; i--) {
					const singleFeatureCoords = features[i]
						.getGeometry()
						.getCoordinates();
					for (let j in singleFeatureCoords) {
						coords.push(singleFeatureCoords[j]);
					}

					if (i !== 0) {
						source.removeFeature(features[i]);
					}
				}

				const geom = features[0].getGeometry();
				geom.setCoordinates(coords);

				if (geom.getCoordinates().length > 2) {
					type = 'Polygon';
				} else {
					type = 'LineString';
				}

				const featureGeom = {
					type: type,
					coordinates: coords,
				};

				let centroidPoint = centroid(featureGeom);
				const modifiedFeature = new Feature(
					new MultiPoint(centroidPoint.geometry.coordinates)
				);

				const featureProp = this.getClonedFeatureProp(
					source,
					features[0],
					modifiedFeature
				);
				modifiedFeature.setProperties(featureProp);

				source.addFeature(modifiedFeature);
			}

      return modifiedFeature
		}
	}

	/** 
	 * @purpose 피쳐 병합
	 */
	merge(features = [Feature], source = VectorSource) {
		let coords = [];

		const reader = new GeoJSONReader();
		const writer = new GeoJSONWriter();
		const geoJson = new GeoJSON();

		if (this.checkType(features)) {
			if (features[0].getGeometry().getType() === 'Point') {
				for (let i = 0; i < features.length; i++) {
					coords.push(features[i].getGeometry().getCoordinates());
					source.removeFeature(features[i]);
				}

				const newPoint = new Feature(new MultiPoint(coords));
				const prop = this.getClonedFeatureProp(features[0], newPoint);
				newPoint.setProperties(prop);

				source.addFeature(newPoint);
			}

			if (features[0].getGeometry().getType() === 'MultiPoint') {
				for (let i = 0; i < features.length; i++) {
					for (let j = 0; j < features[i].length; i++) {
						const p = features[i].getGeometry().getCoordinates()[j];
						if (!coords.includes(p)) {
							coords.push(p);
						}
					}
					if (i !== 0) {
						source.removeFeature(features[i]);
					}
				}

				const newPoint = new Feature(new MultiPoint(coords));
				const prop = this.getClonedFeatureProp(features[0], newPoint);
				newPoint.setProperties(prop);

				source.addFeature(newPoint);
			}

			if (features[0].getGeometry().getType() === 'LineString') {
				const merge = new LineMerger();

				// 병합할 수 있는지 Check
				for (let i = 0; i < features.length; i++) {
					let sNum = 0;
					let eNum = 0;
					let feature = features[i];
					for (let j = 0; j < features.length; j++) {
						if (i !== j) {
							const a = feature.getGeometry().getCoordinates();
							const b = features[j].getGeometry().getCoordinates();
							let sDuplicate = function (a, b) {
								if (a[0][0] === b[0][0] && a[0][1] === b[0][1]) {
									return true;
								}
								if (
									a[0][0] === b[b.length - 1][0] &&
									a[0][1] === b[b.length - 1][1]
								) {
									return true;
								}
								return false;
							};
							let eDuplicate = function (a, b) {
								if (
									a[a.length - 1][0] === b[0][0] &&
									a[a.length - 1][1] === b[0][1]
								) {
									return true;
								}
								if (
									a[a.length - 1][0] === b[b.length - 1][0] &&
									a[a.length - 1][1] === b[b.length - 1][1]
								) {
									return true;
								}
								return false;
							};
							if (sDuplicate(a, b)) {
								sNum += 1;
							}
							if (eDuplicate(a, b)) {
								eNum += 1;
							}
						}
					}
					if (sNum === 0 && eNum === 0) {
						alert('병합 할 수 없습니다.');
						return;
					} else {
						break;
					}
				}

				// geometry merge
				for (let i = 0; i < features.length; i++) {
					const geomObj = {
						type: features[i].getGeometry().getType(),
						coordinates: features[i].getGeometry().getCoordinates(),
					};

					const geom = reader.read(geomObj);
					merge.add(geom);

					if (i !== 0) {
						source.removeFeature(features[i]);
					}
				}

				// create merge geometry
				const newCoord = writer.write(
					merge.getMergedLineStrings().toArray()[0]
				).coordinates;

				const geomObj = {
					type: 'LineString',
					coordinates: newCoord,
				};

				// setGeometry
				const newGeom = geoJson.readGeometry(geomObj);
				features[0].setGeometry(newGeom);
			}

			if (features[0].getGeometry().getType() === 'MultiLineString') {
				let mergeGeom = null;

				for (let i = 0; i < features.length; i++) {
					if (!mergeGeom) {
						mergeGeom = reader.read({
							type: features[i].getGeometry().getType(),
							coordinates: features[i].getGeometry().getCoordinates(),
						});
					} else {
						const geom = reader.read({
							type: features[i].getGeometry().getType(),
							coordinates: features[i].getGeometry().getCoordinates(),
						});
						mergeGeom = UnionOp.union(mergeGeom, geom);
					}
				}

				features[0].setGeometry(geoJson.readGeometry(writer.write(mergeGeom)));

				for (let i = features.length - 1; i >= 0; i--) {
					if (i !== 0) {
						source.removeFeature(features[i]);
					}
				}
			}

			if (features[0].getGeometry().getType() === 'Polygon') {
				let mergeGeom = null;

				for (let i = 0; i < features.length; i++) {
					if (!mergeGeom) {
						mergeGeom = reader.read({
							type: features[i].getGeometry().getType(),
							coordinates: features[i].getGeometry().getCoordinates(),
						});
					} else {
						const geom = reader.read({
							type: features[i].getGeometry().getType(),
							coordinates: features[i].getGeometry().getCoordinates(),
						});
						mergeGeom = UnionOp.union(mergeGeom, geom);
					}
				}

				if (
					mergeGeom.getGeometryType() !== features[0].getGeometry().getType()
				) {
					alert(
						'대상 피쳐는 Polygon 이지만, 결과 피쳐는 MultiPolygon 입니다. 서로 겹치거나 맞닿아 있는 피쳐를 선택해서 병합해주세요.'
					);
					return;
				} else {
					if (
						features[0].getGeometry().getType() === mergeGeom.getGeometryType()
					) {
						features[0].setGeometry(
							geoJson.readGeometry(writer.write(mergeGeom))
						);
						for (let i = features.length - 1; i >= 0; i--) {
							if (i !== 0) {
								source.getSource().removeFeature(features[i]);
							}
						}
					}
				}
			}

			if (features[0].getGeometry().getType() === 'MultiPolygon') {
				//MultiPolygon 좌표 병합
				let mergeGeom = null;
				for (let i = 0; i < features.length; i++) {
					if (!mergeGeom) {
						mergeGeom = reader.read({
							type: features[i].getGeometry().getType(),
							coordinates: features[i].getGeometry().getCoordinates(),
						});
					} else {
						const geom = reader.read({
							type: features[i].getGeometry().getType(),
							coordinates: features[i].getGeometry().getCoordinates(),
						});
						mergeGeom = UnionOp.union(mergeGeom, geom);
					}
				}

				const outputGeom = geoJson.readGeometry(writer.write(mergeGeom));
				if (outputGeom.getType() === 'Polygon') {
					features[0].setGeometry(
						new MultiPolygon([outputGeom.getCoordinates()])
					);
				} else {
					features[0].setGeometry(outputGeom);
				}

				for (let i = features.length - 1; i >= 0; i--) {
					if (i !== 0) {
						source.removeFeature(features[i]);
					}
				}
			}
		}
	}

	/** 
	 * @purpose 피쳐 분할
	 */
	split(feature = Feature, source = VectorSource) {

    let newFeatures = [];

		if (feature.getGeometry().getType() === 'MultiPoint') {
			const coords = feature.getGeometry().getCoordinates();

			for (let i = 1; i < coords.length; i++) {
				const newFeature = new Feature(new MultiPoint(coords[i]));
				const newProp = this.getClonedFeatureProp(feature, newFeature);

				newFeature.setProperties(newProp);
				source.addFeature(newFeature);
        newFeatures.push(newFeature);
			}

			feature.setGeometry(new MultiPoint(coords[0]));
		}

		if (feature.getGeometry().getType() === 'MultiLineString') {
			const coords = feature.getGeometry().getCoordinates();

			for (let i = 1; i < coords.length; i++) {
				const newFeature = new Feature(new MultiLineString([coords[i]]));
				const newProp = this.getClonedFeatureProp(feature, newFeature);

				newFeature.setProperties(newProp);
				source.addFeature(newFeature);
        newFeatures.push(newFeature);
			}

			feature.setGeometry(new MultiLineString([coords[0]]));
		}

		if (feature.getGeometry().getType() === 'MultiPolygon') {
			const coords = feature.getGeometry().getCoordinates();

			for (let i = 1; i < coords.length; i++) {
				const newFeature = new Feature(new MultiPolygon([coords[i]]));
				const newProp = this.getClonedFeatureProp(feature, newFeature);

				newFeature.setProperties(newProp);
				source.addFeature(newFeature);
        newFeatures.push(newFeature);
			}

			feature.setGeometry(new MultiPolygon([coords[0]]));
		}

    return newFeatures;
	}

	/**
	 * @purpose 선을 그려 도형 자르기
   * @param l2 (e, newFeatures) => {} // created feature pieces
	 */
	crop(feature = Feature, source = VectorSource, l1 = (e) => {} , l2 = (e, newFeatures) => {}) {

    let select;
    let newFeatures = [];

		this.map.getInteractions().getArray().forEach(function (interaction) {
			if (interaction instanceof Select) {
        select = interaction;
        select.setActive(false);
			}
		});

		const drawEvent = new Draw({ geometryName: 'geom', type: 'LineString' });

		const targetLine = new Feature(
			new LineString(feature.getGeometry().getCoordinates()[0])
		);

		if (feature.getGeometry().getType() === 'LineString'){};

		if (feature.getGeometry().getType() === 'MultiLineString') {

      if(l1 !== null){
        drawEvent.on('drawstart', l1)
      }

			drawEvent.on('drawend', function (e) {
				const geoJson = new GeoJSON();
				const target = geoJson.writeFeatureObject(targetLine);
				const splitLine = geoJson.writeFeatureObject(e.feature);

				const intersect = lineSplit(target, splitLine);

				if (intersect.features.length > 1) {
					for (let i = 0; i < intersect.features.length; i++) {
						if (i === 0) {
							const newGeom = intersect.features[0].geometry.coordinates;
							feature.setGeometry(new MultiLineString([newGeom]));
						} else {
							const addGeom = intersect.features[i].geometry.coordinates;
							const addFeature = new Feature(new MultiLineString([addGeom]));

							const newProp = this.getClonedFeatureProp(feature, addFeature);
              
							addFeature.setProperties(newProp);
							source.addFeature(addFeature);
							newFeatures.push(addFeature);
						}

            if(select){
              select.setActive(true);
            }

						l2(e, newFeatures);
					}
				} else {
					alert('분할할 피쳐가 없습니다.');
				}

				this.map.removeInteraction(drawEvent);
			}.bind(this));
			this.map.addInteraction(drawEvent);
		}

		if (feature.getGeometry().getType() === 'Polygon') {
		}

		if (feature.getGeometry().getType() === 'MultiPolygon') {

      drawEvent.on('drawstart', function (e) {
        if(l1){
          l1(e);
        }
      })

			drawEvent.on('drawend', function (e) {
				const reader = new GeoJSONReader();
				const writer = new GeoJSONWriter();
				const geoJson = new GeoJSON();

				const target = reader.read({
					type: 'Polygon',
					coordinates: feature.getGeometry().getCoordinates()[0],
				});

				const splitLine = reader.read({
					type: e.feature.getGeometry().getType(),
					coordinates: e.feature.getGeometry().getCoordinates(),
				});

				const union = UnionOp.union(target.getExteriorRing(), splitLine);
				const polygonizer = new Polygonizer();
				polygonizer.add(union);

				const polygons = polygonizer.getPolygons();

				if (polygons.array.length > 1) {
					for (let i = 0; i < polygons.array.length; i++) {
						const readGeom = geoJson.readGeometry(
							writer.write(polygons.array[i])
						);

						if (i === 0) {
							feature.setGeometry(
								new MultiPolygon([readGeom.getCoordinates()])
							);
						} else {
							const newFeature = new Feature(
								new MultiPolygon([readGeom.getCoordinates()])
							);
							const newProp = this.getClonedFeatureProp(feature, newFeature);
							newFeature.setProperties(newProp);
							source.addFeature(newFeature);
              newFeatures.push(newFeature)

							l2(e, newFeatures);
						}
					}
				} else {
					alert('분할할 피쳐가 없습니다.');
				}

				this.map.removeInteraction(drawEvent);
        select.setActive(true);
			}.bind(this));
			this.map.addInteraction(drawEvent);
		}

    return newFeatures
	}

	/** 
	 * @purpose 선 노드별 분할
	 */
	lineNodeSplit(features = [Feature], source = VectorSource) {

    let select;
    let addFeatures = [];

    this.map.getInteractions().getArray().forEach(function (interaction) {
			if (interaction instanceof Select) {
        select = interaction;
			}
		});

    for (let feature of features) {
      const entireCoords = feature.getGeometry().getCoordinates(); 

      entireCoords.forEach((coords, idx) => {
        // coordinate가 2개 이상 (노드가 2개 이상이면)
        for (let i = 0; i < coords.length; i++) {

          let newFeature;

          if (coords.length > 2) {
            const coord = coords.slice(i, i + 2);

            if(feature.getGeometry().getType().indexOf('Multi') !== -1){
              newFeature = new Feature(new MultiLineString([coord]));
            } else {
              newFeature = new Feature(new LineString(coord));
            }
            
            const beforeProp = this.getClonedFeatureProp(feature, newFeature)
            newFeature.setProperties(beforeProp);

            if(coord.length > 1){
              source.addFeature(newFeature);
              addFeatures.push(newFeature);
            }            

            if(select && idx === 0 && i === 0){
              select.getFeatures().clear();
              select.getFeatures().push(newFeature);
            }

          } 
        }  
      })
		}

    if(!addFeatures.length > 0){
      alert('분할 피쳐 없음')
    }

    return addFeatures
	}
}
