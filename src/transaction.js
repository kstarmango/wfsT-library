/** 
Create wfs-transaction call for OpenLayers

@module mango/wfs-transaction
@author Hyeokjin Kim <kstarmango@gmail.com>
@version 0.1.0
@license MIT
@copyright (c) MangoSystem
*/

import { WFS, GML } from 'ol/format';
import axios from 'axios';
import dom2str from 'dom-to-string';
import parseXML from 'xml-parse-from-string';

export default class WfsTransaction {
	/**
	 * @param {options} options - url, featureNS, srsName
	 */
	constructor(options) {
		/**
		 * @type {string}
		 * @private
		 */
		this.featureNS = options.featureNS;

		/**
		 * @type {string}
		 * @private
		 */
		this.srsName = options.srsName;

		/**
		 * @type {string}
		 * @private
		 */
		this.url =
			options.url +
			'wfs?dataType=xml&processData=false&contentType=text/xml&version=1.1.0&request=transaction';

		/**
		 * @type {Array}
		 * @private
		 */
		this.editedItems = [];
	}

	/**
	 * transact call create and serialize
	 * @param {string} mode - insert, update, delete
	 * @param {feature} feature
	 * @param {layerName} layerName
	 */
	createTransact(mode, feature, layerName) {
		if (feature.getGeometryName() !== 'geom') {
			feature.setGeometryName('geom');
		}

		const formatWFS = new WFS();

		let formatGML = new GML({
			featureNS: this.featureNS,
			featureType: layerName,
			srsName: this.srsName,
		});

		let node = null;

		switch (mode) {
			case 'insert':
				node = formatWFS.writeTransaction([feature], null, null, formatGML);
				break;
			case 'update':
				node = formatWFS.writeTransaction(null, [feature], null, formatGML);
				break;
			case 'delete':
				node = formatWFS.writeTransaction(null, null, [feature], formatGML);
				break;
			default:
				break;
		}

		const dataStr = new XMLSerializer().serializeToString(node);

		return dataStr;
	}

	/**
	 * single transact call
	 * @param {string} mode - insert, update, delete
	 * @param {feature} feature
	 * @param {layerName} layerName
	 */
	submitTransact(mode, feature, layerName) {
		const createWfstXml = this.createTransact(mode, feature, layerName);
		return this.post(createWfstXml);
	}

	setEditedItems(editItems) {
		return (this.editedItems = editItems);
	}

	addEditedItems(mode, feature, layerName) {
		return this.editedItems.push({
			mode: mode,
			feature: feature,
			layerName: layerName,
		});
	}

	/**
	 * @param {editedItems_} {[ mode, feature, layerName ]}
	 * @return post res
	 */
	submitMultiTransact(editedItems_) {
		let editedItems;

		if (this.editedItems) {
			editedItems = this.editedItems;
		} else if (editedItems_) {
			editedItems = editedItems_;
		}

		let convertWfstXml = null;
		const layerNames = [];

		for (let item of editedItems) {
			if (!layerNames.includes(item.layerName)) {
				layerNames.push(item.layerName);
			}
		}

		for (let i = 0; i < layerNames.length; i++) {
			const edited = editedItems.filter(
				(item) => item.layerName === layerNames[i]
			);

			for (let item of edited) {
				const createWfstXml = this.createTransactWFS(
					item.mode,
					item.feature,
					item.layerName
				);

				let typeWfstXml = parseXML(createWfstXml);

				if (convertWfstXml === null) {
					convertWfstXml = typeWfstXml;
				} else {
					let selectWfstXml = null;
					if (item.type === 'delete') {
						selectWfstXml = typeWfstXml.getElementsByTagName('Delete')[0];
					} else {
						if (item.type === 'insert') {
							selectWfstXml = typeWfstXml.getElementsByTagName('Insert')[0];
						} else {
							selectWfstXml = typeWfstXml.getElementsByTagName('Update')[0];
						}
					}
					convertWfstXml.children[0].append(selectWfstXml);
				}
			}
		}

		let requestWfstXml = dom2str(convertWfstXml.children[0]);
		const res = this.post(requestWfstXml);
		if (res) {
			this.editedItems = [];
			return res;
		}
	}

	post(requestWfstXml) {
		axios
			.post(this.url, requestWfstXml, {
				headers: { 'Content-Type': 'text/xml' },
			})
			.then((res) => {
				return res;
			})
			.catch((err) => {
				console.log(err);
			});
	}
}
