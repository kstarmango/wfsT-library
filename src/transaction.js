import { WFS, GML } from 'ol/format';
import axios from 'axios';
import dom2str from 'dom-to-string';
import parseXML from 'xml-parse-from-string';

export default class WfsTransaction {
	/**
	 * 
	 * sdfsdfsdf
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
	 * @param {string} type - insert, update, delete
	 * @param {feature} feature
	 * @param {layerName} layerName
	 */
	createTransact(type, feature, layerName) {
		const formatWFS = new WFS();

		let formatGML = new GML({
			featureNS: this.featureNS,
			featureType: layerName,
			srsName: this.srsName,
		});

		let node = null;

		switch (type) {
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

		let dataStr = new XMLSerializer().serializeToString(node);

		if (dataStr.indexOf('geometry') !== -1) {
			dataStr = dataStr.replace(/geometry/gi, 'geom');
		}

		return dataStr;
	}

	/**
	 * single transact call
	 * @param {string} type - insert, update, delete
	 * @param {feature} feature
	 * @param {layerName} layerName
	 */
	submitTransact(type, feature, layerName) {
		const createWfstXml = this.createTransact(type, feature, layerName);
		const res = this.postRequest(createWfstXml);

		if (res) {
			this.editedItems = [];
			return res;
		}
	}

	setEditedItems(editItems) {
		return (this.editedItems = editItems);
	}

	addEditedItems(type, feature, layerName) {
		return this.editedItems.push({
			type: type,
			feature: feature,
			layerName: layerName,
		});
	}

	/**
	 * @param {editedItems_} [{ type, feature, layerName }]
	 * @return post res
	 */
	submitMultiTransact(editedItems_) {
		let editedItems;

		if (editedItems_) {
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
				const createWfstXml = this.createTransact(
					item.type,
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

		if (convertWfstXml !== null) {
			let requestWfstXml = dom2str(convertWfstXml.children[0]);
			const res = this.postRequest(requestWfstXml);

			if (res) {
				this.editedItems = [];
				return res;
			}
		}
	}

	postRequest(requestWfstXml) {
		return axios
			.post(this.url, requestWfstXml, {
				headers: { 'Content-Type': 'text/xml' },
			})
			.then((res) => {
				if (res.status === 200) {
					return res.data;
				}
			})
			.catch((err) => {
				console.log(err);
			});
	}
}
