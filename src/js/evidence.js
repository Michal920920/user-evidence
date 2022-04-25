class UserList {
	constructor(form) {
		this.renderInputs = [Input.surname, Input.firstName, Input.streetNum, Input.city, Input.genderId, Input.dateBirth, Input.email];
		this.form = form;
		this.init()
	}

	init() {
		this.renderTable();
	}

	set onClickRow(callback) {
		this.handleClickRow = callback;
	}

	/**
	 * Redraw rows with current data
	 */
	redrawTable = () => {
		let HTMLTableBody = document.getElementById('js-table').querySelector('tbody');
		HTMLTableBody.innerHTML = "";
		this.renderRows(HTMLTableBody);
	}

	/**
	 * Create tbody and render rows
	 */
	renderTable() {
		let HTMLTable = document.getElementById('js-table');
		let HTMLTableBody = document.createElement('tbody');
		this.renderRows(HTMLTableBody);
		HTMLTable.append(HTMLTableBody);
	}

	/**
	 * Render rows, with sorted data from localstorage
	 */
	renderRows(HTMLTableBody) {
		let data = this.sortData(lsManager.getItem());
		for (const row of data) {
			let tr = document.createElement('tr');
			for (const input of this.renderInputs) {
				let td = document.createElement('td');
				td.innerText = formatOutput(input.type, row[input.name]);
				tr.appendChild(td);
			}
			tr.addEventListener('click', (e) => {
				this.form.setFormValuesByUuid(row.uuid);
				this.handleClickRow();
			})
			HTMLTableBody.appendChild(tr);
		}
	}

	/**
	 * Priority sort by:
	 * 1. surname
	 * 2. first name
	 * 2. address
	 */
	sortData(data) {
		return data.sort((a, b) => {
			if (a.surname && a.first_name && a.street_num) {
				let aFirstChar = a.surname.charAt(0);
				let bFirstChar = b.surname.charAt(0);
				if (aFirstChar > bFirstChar) {
					return 1;
				} else if (aFirstChar < bFirstChar) {
					return -1;
				} else {
					let aLastChar = a.first_name.charAt(0);
					let bLastChar = b.first_name.charAt(0);
					if (aLastChar > bLastChar) {
						return 1;
					} else if (aLastChar < bLastChar) {
						return -1;
					} else {
						let aFirstChar = a.street_num.charAt(0);
						let bFirstChar = b.street_num.charAt(0);
						if (aFirstChar > bFirstChar) {
							return 1;
						} else if (aFirstChar < bFirstChar) {
							return -1;
						} else {
							return 0;

						}
					}
				}
			}
		});
	}
}

class Form {

	constructor(form) {
		this.form = form;
		this.userDetail = null;
		this.inputs = [Input.firstName, Input.surname, Input.email, Input.streetNum, Input.city, Input.genderId, Input.dateBirth, Input.uuid];
		this.init()
	}

	set onSave(callback) {
		this.handleOnSave = callback;
	}

	set onDelete(callback) {
		this.handleOnDelete = callback;
	}

	init() {
		const inputsValidate = this.inputs.filter((input) => input.validate === true);
		new FormValidator(inputsValidate);
		this.autocomplete = new AddressAutocomplete(this.form);
		this.onSubmitProcess();
		this.initDeleteButton();
	}

	/**
	 * Fill form with values from localStorage by uuid
	 */
	setFormValuesByUuid(uuid) {
		if (this.userDetail) {
			this.userDetail.hide();
		}
		let lsData = lsManager.getItem();
		let row = lsData.find(item => item.uuid === uuid);
		if (row) {
			this.setFormLegend(`${row[Input.firstName.name]} ${row[Input.surname.name]}`);
			this.setFormValues(row);
			this.initDeleteButton();
			this.userDetail = new UserDetail(row);
			this.userDetail.show();
		}
	}

	/**
	 * Set label above form
	 */
	setFormLegend(value) {
		let legend = this.form.querySelector("legend");
		if (value) {
			legend.innerText = `Editace: ${value}`;
		} else {
			legend.innerText = "Vytvoření záznamu";

		}
	}

	/**
	 * On click submit
	 * - do validation
	 * - form data saves to localStorage
	 * - reset form to default
	 */
	onSubmitProcess() {
		this.form.addEventListener('submit', e => {
			e.preventDefault();
			const formValues = this.getFormValues();
			this.saveFormToLS(formValues);
			this.formReset();
			this.handleOnSave();
		})
	}

	/**
	 * Initial delete button behavior
	 */
	initDeleteButton() {
		let old_element = document.getElementById("js-delete-row");
		let new_element = old_element.cloneNode(true);
		old_element.parentNode.replaceChild(new_element, old_element);

		let HTMLButton = document.getElementById('js-delete-row');
		let uuid = this.form.querySelector(`input[name="${Input.uuid.name}"]`).value;
		if (uuid !== "") {
			HTMLButton.style.display = "block";
			HTMLButton.addEventListener('click', async (e) => {
				e.preventDefault();
				if (confirm("Opravdu si přejete uživatele smazat?")) {
					await this.deleteFromLSByUuid(uuid);
					this.handleOnDelete();
				}
			});
		} else {
			HTMLButton.style.display = "none";
		}
	}

	/**
	 * Delete row from localStorage by uuid
	 */
	deleteFromLSByUuid = async (uuid) => {
		let lsData = lsManager.getItem();
		let saveData = lsData.filter(item => item.uuid !== uuid) ?? [];
		if (saveData.length !== lsData.length) {
			lsManager.removeItem();
			if (saveData.length > 0) {
				await delay(100);
				lsManager.saveToLS(saveData)
			}
		}
	}

	/**
	 * Save data to local storage
	 * - if row currently exist do update
	 * - if row doesn't exist do save
	 */
	saveFormToLS(data) {
		let lsData = lsManager.getItem();
		let updateRowIndex = lsData.findIndex(item => item.uuid === data.uuid);
		if (updateRowIndex !== -1) {
			lsData[updateRowIndex] = data;
		} else {
			data.uuid = createUUID();
			lsData.push(data);
		}
		lsManager.saveToLS(lsData);
	}

	/**
	 * Reset form to default
	 */
	formReset() {
		this.form.reset();
		this.setFormLegend(null);
		this.form.querySelector(`input[name="${Input.uuid.name}"]`).value = "";
		this.autocomplete.hideAutocomplete();
		if (this.userDetail) {
			this.userDetail.hide();
		}
		this.initDeleteButton();
	}

	/**
	 * returns actual filled form values
	 */
	getFormValues() {
		let data = {};
		this.inputs.forEach(input => {
			let value = null;
			if (input.type === "text") {
				value = document.querySelector(`#${input.name}`).value ?? null;
			} else if (input.type === "radio") {
				value = document.querySelector(`input[name="${input.name}"]:checked`).value;
			} else if (input.type === "hidden") {
				value = document.querySelector(`input[name="${input.name}"]`).value;
			} else if (input.type === "email") {
				value = document.querySelector(`input[name="${input.name}"]`).value;
			}
			if (value) {
				data[input.name] = value;
			}
		});

		return data;
	}

	/**
	 * Fill form with data
	 */
	setFormValues(data) {
		this.inputs.forEach(input => {
			let inputEl = null;
			if (input.type === "text") {
				inputEl = document.querySelector(`#${input.name}`);
			} else if (input.type === "radio") {
				inputEl = document.querySelector(`input[name="${input.name}"]:checked`);
			} else if (input.type === "hidden") {
				inputEl = document.querySelector(`input[name="${input.name}"]`);
			} else if (input.type === "email") {
				inputEl = document.querySelector(`input[name="${input.name}"]`);
				data[input.name] = data[input.name];
			}
			if (inputEl) {
				inputEl.value = data[input.name] ?? "";
			}
		});
	}
}

class UserDetail {

	constructor(values) {
		this.renderInputs = [Input.surname, Input.firstName, Input.streetNum, Input.city, Input.genderId, Input.dateBirth, Input.email];
		this.values = values;
	}

	show() {
		this.renderDetail();
	}

	hide() {
		let HTMLUserDetail = document.getElementById("js-user-detail");
		HTMLUserDetail.innerHTML = "";
	}

	/**
	 * Render div structure with selected user data
	 */
	renderDetail() {
		let HTMLUserDetail = document.getElementById("js-user-detail");
		let HTMLCard = document.createElement('div');
		HTMLCard.classList.add("card");
		HTMLCard.innerHTML = "<h2>Karta uživatele</h2>";
		for (const item of this.renderInputs) {
			let HTMLDivEl = document.createElement('div');
			let HTMLLabelEl = document.createElement('span');
			let HTMLValEl = document.createElement('span');
			HTMLLabelEl.innerText = item.label;
			HTMLValEl.innerText = formatOutput(item.type, this.values[item.name]);
			HTMLDivEl.append(HTMLLabelEl);
			HTMLDivEl.append(HTMLValEl);
			HTMLCard.append(HTMLDivEl);
		}
		HTMLUserDetail.append(HTMLCard);
	}
}

/**
 * Show list with suggestion to address input
 */
class AddressAutocomplete {
	mapyCzApiUrl = `https://api.mapy.cz/suggest/?count=10&bounds=48.5370786%2C12.0921668%7C51.0746358%2C18.8927040`

	constructor(form) {
		this.form = form;
		this.init();
	}

	init() {
		const HTMLInputStreetNumEl = this.form.querySelector(`#${Input.streetNum.name}`);
		if (HTMLInputStreetNumEl) {
			const showList = debounce(async (e) => await this.showAutocompleteList(e.target.value, HTMLInputStreetNumEl), 500);
			HTMLInputStreetNumEl.addEventListener('input', e => showList(e));
		}
	}

	hideAutocomplete() {
		let HTMLAutocompleteList = this.form.getElementsByClassName('autocomplete-list')[0];
		if (HTMLAutocompleteList) {
			HTMLAutocompleteList.outerHTML = "";
		}
	}

	async showAutocompleteList(value, HTMLInputEl) {
		const HTMLAutocompleteWrp = document.getElementById('autocomplete');
		const HTMLInputCityNumEl = this.form.querySelector(`#${Input.city.name}`);

		let HTMLAutocompleteList = this.form.getElementsByClassName('autocomplete-list')[0];
		if (HTMLAutocompleteList) {
			HTMLAutocompleteList.remove();
		}
		const response = await this.getJsonFromApi(value);
		const street = response.result.filter(item => (item.category === "street_cz" || item.category === "address_cz"));

		if (street.length > 0) {
			let list = document.createElement('ul');
			list.classList.add('autocomplete-list');
			for (const row of street) {
				const streetNum = row.userData.suggestFirstRow;
				const city = row.userData.municipality;
				let li = document.createElement('li');

				li.appendChild(document.createTextNode(`${streetNum}, ${city}`));
				li.dataset.streetNum = row.userData.suggestFirstRow;
				li.dataset.city = row.userData.municipality;

				li.addEventListener('click', (e) => {
					HTMLInputEl.value = e.target.dataset.streetNum;
					HTMLInputCityNumEl.value = e.target.dataset.city;
					list.remove();
				});
				list.appendChild(li);
			}
			HTMLAutocompleteWrp.append(list)
		}
	}

	async getJsonFromApi(phase) {
		const query = `&phrase=${phase}`;
		const apiUrl = this.mapyCzApiUrl.concat(query);
		return await fetch(apiUrl, {method: "GET"}).then((response) => response.json());
	}
}

/**
 * Validates selected inputs
 */
class FormValidator {
	constructor(inputs) {
		this.inputs = inputs;
		this.init();
	}

	init() {
		this.onBlurProcess();
	}

	onBlurProcess() {
		this.inputs.forEach(input => {
			const HTMLInputEl = document.querySelector(`#${input.name}`)
			if (HTMLInputEl !== null) {
				const processChange = debounce(() => this.handleOnChange(HTMLInputEl, input), 200);
				HTMLInputEl.addEventListener('input', e => processChange());
			}
		})
	}

	handleOnChange(HTMLInputEl, input) {
		const HTMLSubmitEl = document.querySelector('input[type="submit"]')
		const result = this.validateByInput(HTMLInputEl, input);
		this.cleanErrorMessage(HTMLInputEl);
		if (result.status === false) {
			this.setErrorMessage(HTMLInputEl, input.errorMsg);
			HTMLSubmitEl.disabled = true;
		} else {
			HTMLSubmitEl.disabled = false;
		}
	}

	cleanErrorMessage(inputEl) {
		let errMsgEl = inputEl.parentElement.querySelector('.error-message');
		if (errMsgEl) {
			errMsgEl.innerText = "";
			inputEl.classList.remove('input-error');
		}
	}

	setErrorMessage(inputEl, message) {
		inputEl.insertAdjacentHTML('afterend', `<span class="error-message">${message}</span>`);
		inputEl.parentElement.querySelector('.error-message').innerText = message;
		inputEl.classList.add('input-error');
	}

	validateByInput(inputEl, input) {
		const value = inputEl.value;
		const rule = input.rule;
		let validationResult = true;
		if (rule) {
			if (rule.maxCharLength) {
				if (value.length > rule.maxCharLength) {
					validationResult = false;
				}
			}
			if (rule.pattern) {
				if (rule.pattern.test(value) === false) {
					validationResult = false;
				}
			}
		}
		return {status: validationResult};
	}
}

/**
 * Inputs configuration
 */
class Input {
	static firstName = new Input("first_name", "Jméno", "text", true, {maxCharLength: 50}, "Překročen max. počet znaků (50 znaků)")
	static surname = new Input("surname", "Příjmení", "text", true, {maxCharLength: 50}, "Překročen max. počet znaků (50 znaků)")
	static streetNum = new Input("street_num", "Adresa", "text", true, {maxCharLength: 200}, "Překročen max. počet znaků (200 znaků)")
	static city = new Input("city", "Obec", "text", true)
	static genderId = new Input("gender_id", "Pohlaví", "radio")
	static dateBirth = new Input("date_birth", "Datum narození", "text", true, {pattern: /(0[1-9]|[12][0-9]|3[01])[.](0[1-9]|1[012])[.](19|20)[0-9]{2}/}, "Zadejte datum ve formátu dd.mm.rrrr")
	static email = new Input("email", "Email", "email", true, {pattern: /\S+@\S+\.\S+/}, "Nepovolený formát emailové adresy")
	static uuid = new Input("uuid", "", "hidden")

	constructor(name, label, type, validate, rule, errorMsg) {
		this.name = name
		this.label = label
		this.type = type
		this.validate = validate
		this.rule = rule
		this.errorMsg = errorMsg
	}

}

/**
 * HELPERS
 */
const debounce = (func, timeout = 300) => {
	let timer;
	return (...args) => {
		clearTimeout(timer);
		timer = setTimeout(() => {
			func.apply(this, args);
		}, timeout);
	};
}
const createUUID = () => {
	return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
		let r = Math.random() * 16 | 0, v = c === 'x' ? r : (r & 0x3 | 0x8);
		return v.toString(16);
	});
}
const getFormattedDate = (dateStr) => {
	if (dateStr === undefined) {
		return ""
	}
	let date = new Date(dateStr);
	let year = date.getFullYear();
	let month = (1 + date.getMonth()).toString().padStart(2, '0');
	let day = date.getDate().toString().padStart(2, '0');
	return day + '.' + month + '.' + year;
}
const formatOutput = (type, value) => {
	let result = "";
	if (type === "date") {
		result = getFormattedDate(value);
	} else if (type === "radio") {
		result = value === "M" ? "Muž" : "Žena";
	} else {
		result = value ?? "";
	}
	return result;
}

const lsManager = {
	saveToLS     : function (data) {
		window.localStorage.setItem("userEvidence", JSON.stringify(data));
	}, getItem   : function () {
		return JSON.parse(window.localStorage.getItem('userEvidence')) || [];
	}, removeItem: function () {
		window.localStorage.removeItem('userEvidence');
	},
};

const delay = ms => new Promise(res => setTimeout(res, ms));

/**
 * BASE DOCUMENT INICIALIZATION
 */
const documentInit = (form, list) => {
	const createUserBtn = document.getElementById('js-create-user');
	const showListBtn = document.getElementById('js-show-list');

	const formWrp = document.getElementById('js-section-form');
	const listWrp = document.getElementById('js-section-list');

	form.onSave = () => {
		formWrp.style.display = "none";
		listWrp.style.display = "block";
		list.redrawTable();
	};

	form.onDelete = () => {
		formWrp.style.display = "none";
		listWrp.style.display = "block";
		list.redrawTable();
	};

	list.onClickRow = () => {
		formWrp.style.display = "flex";
		listWrp.style.display = "none";
	};

	createUserBtn.addEventListener("click", () => {
		formWrp.style.display = "flex";
		listWrp.style.display = "none";
		form.formReset();
	});

	showListBtn.addEventListener("click", () => {
		formWrp.style.display = "none";
		listWrp.style.display = "block";
		list.redrawTable();
	})
}

document.addEventListener("DOMContentLoaded", function (event) {
	const formEl = document.getElementById("js-evidence-form");
	const form = new Form(formEl);
	const list = new UserList(form);
	documentInit(form, list);
});
