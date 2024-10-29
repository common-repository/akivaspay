import {AkivasPayWidget} from "./assets/apay_script.js";
var checkout_form
var successCallback = function () {
    // deactivate the tokenRequest function event
    checkout_form.off("checkout_place_order", lunchpayqr);

    // submit the form now
    checkout_form.submit();
};

var errorCallback = function (data) {
    console.log(data);
};

var lunchpayqr =  function () {
    let widget = new AkivasPayWidget(apay_params.shop_subscription_key)
     widget.generate(apay_params.shop_name, 'gfgfgfhgh', apay_params.total);
    widget.on('apay-transaction-success', (transaction) => {
        successCallback()
    })
    return false;
};

jQuery(function ($) {
    checkout_form = $("form.woocommerce-checkout");
    checkout_form.on("checkout_place_order", lunchpayqr);
});
