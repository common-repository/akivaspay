const translations = {
  "en": {
    "qr-code-expired": "The Qrcode has expired",
    "scan-to-pay": "Scan to pay",
    "open-in-wallet": "Open in Wallet",
    "how-to-pay": "How do i pay?",
    "awaiting-payment": "Awaiting Payment ...",
    "successful-purchase-msg": "The payment has been successfully completed",
    "regenerate": "regenerate",
    "failed-to-fetch": "The widget failed to load, check your Internet connection.",
    "unknow-error-message": "Something went wrong, please try again later"
  },
  "fr": {
    "qr-code-expired": "Le Qrcode a expiré",
    "scan-to-pay": "Scannez pour payer",
    "open-in-wallet": "Ouvrir dans le portefeuille",
    "how-to-pay": "Comment payer ?",
    "awaiting-payment": "En attente de paiement...",
    "successful-purchase-msg": "Le paiement a été effectué avec succès",
    "regenerate": "régénérer",
    "failed-to-fetch": "Le chargement du widget a échoué, vérifiez votre connexion Internet.",
    "unknow-error-message": "Quelque chose s'est mal passé, veuillez réessayer plus tard"
  }
};

class Localization {
  constructor(locale) {
    this.locale = locale;
  }

  get(key) {
    let t
    try {
      t = translations[this.locale][key];
    } catch (e) {
      t = translations['fr'][key]
    }

    return t;
  }
}

const STATUS_OF_REQUEST = Object.freeze({
  NOT_STARTED: 'not started',
  WAITING: 'waiting',
  LOADING: 'loading',
  FAILED: 'failed',
  SUCCESS: 'success',
  CANCEL: 'cancel'
});

const supported_locales = ['en', 'fr'];
const fallback_locale = 'fr';
const formatCurrency = (number, separator) => {
  if (number) {
    let splitArray = number.toString().split('.')
    let decimalPart = ''
    if (splitArray.length > 1) {
      number = splitArray[0]
      decimalPart = '.' + splitArray[1]
    }
    let formattedNumber = number.toString().replace(/\D/g, "");
    let rest = formattedNumber.length % 3;
    let currency = formattedNumber.substr(0, rest);
    let thousand = formattedNumber.substr(rest).match(/\d{3}/g);

    if (thousand) {
      separator = rest ? separator ? separator : "," : "";
      currency += separator + thousand.join(",");
    }

    return currency + decimalPart;
  } else {
    return "0";
  }
}

class WidgetData {
  constructor(image, domain, link, name, amount, description, external_id) {
    Object.assign(this, {image, domain, link, name, amount, description, external_id});
  }
}

const widgetHeader = (content = '') => `
    <div id="apBoxHeader">
        <div id="apLogo">
            <div id="apLogoCircle">
                <a href="https://akivaspay.com" target="_blank">
                    <img src="https://akivaspay.com/images/AKIVASPAY.png" alt="AkivasPay" />
                </a>
            </div>
            <div id="apLogoText">AkivasPay</div>
        </div>
        ${content}
    </div>
`;

const timerSection = (expired, requestStatus, localization) => `
    <div id="apTimer" style="background-color: ${expired ? 'red' : '#3cb364'}">
        ${
    expired === true ?
        `
                <span id="apTimerText">
                    <span id="apTimerText-left"> ${localization.get('qr-code-expired')}</span>
                    <span id="apTimerText-right"> 
                        <span id="timer"></span> 
                    </span>
                </span>
            ` : requestStatus === STATUS_OF_REQUEST.WAITING ?
        `
                <span id="apTimerMovement"></span>
                <span id="apTimerText">
                    <span id="apTimerText-left"> ${localization.get('awaiting-payment')} </span>
                    <span id="apTimerText-right"> 
                        <span id="timer"></span> 
                    </span>
                </span>
            ` : ''
}
    </div>
`;

function createPrivateStore() {
  let store = new WeakMap();
  return function (inst) {
    let obj = store.get(inst);
    if (!obj) {
      obj = {};
      store.set(inst, obj);
    }
    return obj;
  };
}

const _ = createPrivateStore();

export class AkivasPayWidget {
  constructor(shopSubscriptionKey, locale = fallback_locale) {
    _(this).shopSubscriptionKey = shopSubscriptionKey;
    _(this).baseUrl = "https://api.apay.akivaspay.com/";
    _(this).success = false;
    _(this).requestStatus = STATUS_OF_REQUEST.NOT_STARTED;
    _(this).timeExpired = false;
    _(this).errorMessage = '';
    _(this).locale = locale;
    _(this).apayContainer;
    _(this).modal;
    _(this).widgetData = new WidgetData();
    _(this).checkTransactionInterval;
    _(this).timerInterval;
    _(this).localization = new Localization(locale);
    _(this).events = {
      'apay-transaction-success': []
    };

    var userLang = navigator.language || navigator.userLanguage;
    if (userLang.toLowerCase().includes('en')) {
      _(this).locale = 'en';
    } else {
      _(this).locale = 'fr'
    }
    _(this).apayContainer = document.createElement('div');
    this.initWidget();
  }

  initWidget() {
    _(this).apayContainer.innerHTML = '<div class="akivas-pay-modal" id="akivaspayModal" data-animation="slideInOutLeft"></div>';
    document.querySelector('body').appendChild(_(this).apayContainer);
    _(this).modal = document.getElementById("akivaspayModal");
  }


  regenerateCodeClickEventListener() {
    const regenerateBtn = document.getElementById('apay-regenerate');
    if (regenerateBtn != null && _(this).timeExpired) {
      regenerateBtn.addEventListener('click', () => {
        this.regenerate();
      });
    }
  }

  closeClickEventListener() {
    const closeElts = Object.values(document.getElementsByClassName('apay-close-widget'));
    if (closeElts.length > 0) {
      closeElts.forEach(el => {
        el.addEventListener('click', () => {
          this.closeWidget();
        })
      });
    }

  }

  updateWidget() {
    _(this).modal.innerHTML = this.getWidget();
    this.closeClickEventListener();
  }

  showModal() {
    _(this).modal.innerHTML = this.getWidget();
    this.closeClickEventListener();
  }

  async regenerate() {
    _(this).timeExpired = false;
    _(this).success = false;
    _(this).errorMessage = '';
    this.generate(_(this).widgetData.name, _(this).widgetData.external_id, _(this).widgetData.amount, _(this).widgetData.description);
  }

  async generate(name, external_id, amount, description = '') {
    _(this).requestStatus = STATUS_OF_REQUEST.LOADING;
    _(this).modal.classList.add('visible');
    this.showModal();
    const data = {
      "name": name,
      "uuid": external_id,
      "amount": amount,
      "description": description
    };

    try {
      const response = await fetch(_(this).baseUrl + 'generate/qrcode', {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Accept": "application/json",
          "Accept-Language": _(this).locale,
          "Shop-Subscription-Key": _(this).shopSubscriptionKey
        },
        body: JSON.stringify(data),
      });

      if (response.ok) {
        response.json().then((json) => {
          _(this).widgetData = new WidgetData(
              json.image,
              json.domain,
              json.link,
              json.name,
              json.amount,
              description,
              external_id
          );
          _(this).requestStatus = STATUS_OF_REQUEST.WAITING;
          this.updateWidget();
          var timer = document.getElementById('timer');
          timer.textContent = 30 + ":" + 0;
          this.startTimer();
          this.checkTransactionStatus(json.uuid);
        });

      } else {
        response.json().then((json) => {
          _(this).requestStatus = STATUS_OF_REQUEST.FAILED;
          _(this).errorMessage = json.message;
          this.updateWidget();
        });

      }
    } catch (e) {
      if (e.message === 'Failed to fetch') {
        _(this).errorMessage = _(this).localization.get('failed-to-fetch');
      } else {
        _(this).errorMessage = _(this).localization.get('unknow-error-message');
      }
      _(this).requestStatus = STATUS_OF_REQUEST.FAILED;
      this.updateWidget();
    }

  }

  getWidget() {
    const timerHTML = timerSection(_(this).timeExpired, _(this).requestStatus, _(this).localization);
    let $content = `
            <div class="apay-center-content" style="visibility: ${_(this).requestStatus === STATUS_OF_REQUEST.LOADING ? 'visible' : 'hidden'}">
                <div id="apay-loading"></div>
            </div>
            <div class="apay-center-content" style="text-align: center; color: red; visibility: ${_(this).requestStatus === STATUS_OF_REQUEST.FAILED ? 'visible' : 'hidden'}">
                ${_(this).errorMessage}
            </div>
            <div data-animation="slideInOutLeft" class="apay-widget apay-overflow-scroll-container" style="visibility: ${_(this).requestStatus === STATUS_OF_REQUEST.WAITING ? 'visible' : 'hidden'}">
                <div id="apBox">
                    ${widgetHeader(timerHTML)}
                    <div id="apPrice">
                        <div>
                            <p id="apScantoPayText" style="font-weight: 400; color: #989898">
                                ${_(this).localization.get('scan-to-pay')}
                            </p>
                    
                            <p id="apTo" style="font-weight: 300">
                                <strong style="font-weight: 400; color: 607d8b">${_(this).widgetData.domain}</strong>
                            </p>
                        </div>
                        <div style="color: black">
                            <span style="font-size: 20px; font-weight: 400"> ${formatCurrency(_(this).widgetData.amount)}</span>
                            <sup style="font-weight: 500">FCFA</sup>
                        </div>
                    </div>
                    <div id="apBoxBody">
                        <h1 class="apay-qr-name">${_(this).widgetData.name}</h1>
                        <div id="apQrcodeBox">
                            <img src="${_(this).widgetData.image}" alt="qrcode" style="visibility: ${(!_(this).timeExpired && _(this).requestStatus === STATUS_OF_REQUEST.WAITING) ? 'visible' : 'hidden'}"/>
                        </div>
                        <a id="howToPay" href="https://akivaspay.com/client-documentation/web-payment" target="_blank">${_(this).localization.get('how-to-pay')}</a>
                        <a href="${_(this).widgetData.link}" class="apay-button" target="_blank">
                            ${_(this).localization.get('open-in-wallet')}
                        </a>
                        <br />
                    </div>
                </div>
            </div>
        `;

    if (_(this).success) {
      $content = `
                <div class="apay-widget">
                    <div id="apBox">
                        ${widgetHeader(timerHTML)}
                        <div id="apay-success-content">
                            <div class="apay-success-checkmark">
                                <div class="check-icon">
                                    <span class="icon-line line-tip"></span>
                                    <span class="icon-line line-long"></span>
                                    <div class="icon-circle"></div>
                                    <div class="icon-fix"></div>
                                </div>
                            </div>
                            <h3 class="apay-text-success">Sucessfull purchase</h3>
                            <a href="#" class="apay-sucess-button apay-close-widget">
                                ok
                            </a>
                        </div>
                    </div>
                </div>
            `;
    } else if (_(this).timeExpired) {
      $content = `
                <div class="apay-widget">
                    <div id="apBox">
                        ${widgetHeader(timerHTML)}
                        <div id="apPrice">
                            <div>
                                <p id="apScantoPayText" style="font-weight: 400; color: #989898">
                                    ${_(this).localization.get('scan-to-pay')}
                                </p>
                        
                                <p id="apTo" style="font-weight: 300">
                                    <strong style="font-weight: 400; color: #607d8b"
                                    >${_(this).widgetData.domain}</strong
                                    >
                                </p>
                            </div>
                            <div style="color: black">
                                <span style="font-size: 20px; font-weight: 400"> ${formatCurrency(_(this).widgetData.amount)}</span>
                                <sup style="font-weight: 500">FCFA</sup>
                            </div>
                        </div>
                        <div id="apBoxBody">
                            <div id="apQrcodeBox">
                                <span style="color: red;">
                                    ${_(this).localization.get('qr-code-expired')}
                                </span>
                            </div>
                            <a href="#" id="apay-regenerate" class="apay-button">
                                ${_(this).localization.get('regenerate')}
                            </a>
                            <br />
                        </div>
                    </div>
                </div>
            `;
    } else if (_(this).requestStatus === STATUS_OF_REQUEST.CANCEL) {
      return '';
    }

    return `
            <div>
                <button id="apay-close-btn" class="apay-close-widget">
                    <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                </button>
                <div>
                ${$content}
                </div>
            </div>
        `;
  }

  checkTransactionStatus(uuid) {
    _(this).checkTransactionInterval = setInterval(async () => {
      if (_(this).timeExpired && _(this).checkTransactionInterval !== null) {
        clearInterval(_(this).checkTransactionInterval);
        return;
      }
      let response = await fetch(_(this).baseUrl + 'find/transaction/' + uuid + "?filter_by=uuid", {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
          "Accept": "application/json",
          "Accept-Language": _(this).locale,
          "Shop-Subscription-Key": _(this).shopSubscriptionKey
        }
      });

      if (response.status === 200) {
        response.json().then((json) => {
          if (json.success === true) {
            _(this).success = true;
            _(this).timeExpired = false;
            _(this).requestStatus = STATUS_OF_REQUEST.SUCCESS;
            this.updateWidget();
            this.emit('apay-transaction-success', json.transaction);
            clearInterval(_(this).checkTransactionInterval);
          }

        });

      } else {
        response.json().then((json) => {
          _(this).requestStatus = STATUS_OF_REQUEST.FAILED;
          _(this).errorMessage = json.message;
          this.updateWidget();
          clearInterval(_(this).checkTransactionInterval);
        });

      }

    }, 2500);
  }

  startTimer() {
    _(this).timerInterval = setInterval(() => {
      try {
        let timer = document.getElementById('timer').innerHTML;
        let timeArray = timer.split(/[:]+/);
        let m = parseInt(timeArray[0]);
        let s = AkivasPayWidget.formatSeconds(parseInt((timeArray[1] - 1)));
        if (s === '59') {
          m = m - 1;
        }

        if (_(this).success) {
          clearInterval(_(this).timerInterval);
        }
        if (m < 0 || (m === 0 && s === '00')) {
          clearInterval(_(this).timerInterval);
          _(this).timeExpired = true;
          this.updateWidget()
          document.getElementById('timer').textContent = "";
          this.regenerateCodeClickEventListener();
        } else {
          document.getElementById('timer').textContent = m.toString() + ":" + s.toString();
          let percent = (m / 30) * 100;
          document.getElementById('apTimerMovement').style.width = percent + "%";
        }

      } catch (e) {
      }
    }, 800);

  }

  static formatSeconds(sec) {
    if (sec < 10 && sec >= 0) {
      sec = "0" + sec;
    }
    if (sec < 0) {
      sec = "59";
    }
    return sec;
  }

  closeWidget() {
    _(this).requestStatus = STATUS_OF_REQUEST.CANCEL;
    _(this).modal.classList.remove('visible');

    if (_(this).checkTransactionInterval) {
      clearInterval(_(this).checkTransactionInterval);
    }

    if (_(this).timerInterval) {
      clearInterval(_(this).timerInterval);
    }

    _(this).timeExpired = false;
    _(this).success = false;

    setTimeout(() => {
      _(this).modal.innerHTML = '';
    }, 1000)

  }

  on(event, listener) {
    if (!(event in _(this).events)) {
      _(this).events[event] = [];
    }
    _(this).events[event].push(listener);
  }

  emit(event, ...args) {
    if (!(event in _(this).events)) {
      return;
    }
    _(this).events[event].forEach(listener => listener(...args));
  }
}