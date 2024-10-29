<?php
/*
 * Plugin Name: AkivasPay
 * Plugin URI: http://akivaspay.com
 * Description: AkivasPay wooComerce payment gateway.
 * Author: Akivas Inc
 * Author URI: http://akivas.com
 * Version: 1.0.0
 * Requires at least: 5.6
 * Requires PHP: 7.0
 * License: GPLv3
 * License URI: http://www.gnu.org/licenses/gpl.html
 */


/*
 * This action hook registers our PHP class as a WooCommerce payment gateway
 */

add_filter( 'woocommerce_payment_gateways', 'apay_add_gateway_class' );
function apay_add_gateway_class( $gateways ) {
	$gateways[] = 'WC_APAY_Gateway'; // your class name is here
	return $gateways;
}

/*
 * The class itself, please note that it is inside plugins_loaded action hook
 */
add_action( 'plugins_loaded', 'apay_init_gateway_class' );
function apay_init_gateway_class() {

	class WC_APAY_Gateway extends WC_Payment_Gateway {

 		/**
 		 * Class constructor, more about it in Step 3
 		 */
 		public function __construct() {

            $this->id = 'apay'; // payment gateway plugin ID
            $this->icon = plugins_url( '/assets/aplogo.png', __FILE__ ); // URL of the icon that will be displayed on checkout page near your gateway name
            $this->has_fields = true; // in case you need a custom credit card form
            $this->method_title = 'AkivasPay';
            $this->method_description = 'AkivasPay wooComerce Gateway'; // will be displayed on the options page

            // gateways can support subscriptions, refunds, saved payment methods,
            // but in this tutorial we begin with simple payments
            $this->supports = array(
                'products'
            );

            // Method with all the options fields
            $this->init_form_fields();

            // Load the settings.
            $this->init_settings();
            $this->enabled = $this->get_option( 'enabled' );
            $this->title = $this->get_option( 'title' );
            $this->shop_name = $this->get_option( 'shop_name' );
            $this->shop_subscription_key = $this->get_option( 'shop_subscription_key' );
            $this->description = $this->get_option( 'description' );

            // This action hook saves the settings
            add_action( 'woocommerce_update_options_payment_gateways_' . $this->id, array( $this, 'process_admin_options' ) );

            // We need custom JavaScript to obtain a token
            add_action( 'wp_enqueue_scripts', array( $this, 'payment_scripts' ) );
            
            // You can also register a webhook here
            // add_action( 'woocommerce_api_{webhook name}', array( $this, 'webhook' ) );

 		}

		/**
 		 * Plugin options, we deal with it in Step 3 too
 		 */
 		public function init_form_fields(){

            $this->form_fields = array(
            'enabled' => array(
                'title'       => 'Enable/Disable',
                'label'       => 'Enable AkivasPay',
                'type'        => 'checkbox',
                'description' => '',
                'default'     => 'no'
            ),
                'title' => array(
                    'title'       => 'Title',
                    'type'        => 'text',
                    'default'     => 'AkivasPay',
                ),
            'shop_subscription_key' => array(
                'title'       => 'Shop Subscription',
                'type'        => 'text',
                'description' => 'Your shop subscription key from AkivasPay developer settings',
                'default'     => '',
                'desc_tip'    => true,
            ),
            'description' => array(
                'title'       => 'Description',
                'type'        => 'textarea',
                'description' => 'Pay with AkivasPay mobile wallet',
                'default'     => 'Pay with AkivasPay mobile wallet',
            ),
            'shop_name' => array(
                'title'       => 'Shop Name',
                'type'        => 'text',
                'description' => 'Your Shop Name which will display to users during checkout',
                'default'     => '',
                'desc_tip'    => true,
            ),
        );
	
	 	}


		/*
		 * Custom CSS and JS, in most cases required only when you decided to go with a custom credit card form
		 */
	 	public function payment_scripts() {

            // we need JavaScript to process a token only on cart/checkout pages, right?
            if ( ! is_cart() && ! is_checkout() && ! isset( $_GET['pay_for_order'] ) ) {
                return;
            }

            // if our payment gateway is disabled, we do not have to enqueue JS too
            if ( 'no' === $this->enabled ) {
                return;
            }

            // no reason to enqueue JavaScript if API keys are not set
            if ( empty( $this->shop_subscription_key ) || empty( $this->shop_name ) ) {
                return;
            }

           


            // and this is our custom JS in your plugin directory that works with token.js
//            wp_register_script( 'woocommerce_apay', plugins_url( 'assets/jquery.js', __FILE__ ) );
            wp_register_script( 'woocommerce_apay', plugins_url( 'apay.js', __FILE__ ), array( 'jquery' ) );
            wp_register_style('woocommerce_apay_style', plugins_url('assets/styles.css', __FILE__));

            // in most payment processors you have to use PUBLIC KEY to obtain a token
            $products='';
            foreach ( WC()->cart->get_cart() as $cart_item_key => $cart_item ) {
            $products = $cart_item['data']->get_name().','. $products;
            }
 

            wp_localize_script( 'woocommerce_apay', 'apay_params', array(
                'shop_subscription_key' => $this->shop_subscription_key,
                'shop_name' => $this->shop_name,
                'cart' => $this->shop_name,
                'items'=>$products,
                'total' => WC()->cart->total,
            ) );
            wp_enqueue_style('woocommerce_apay_style');
            wp_enqueue_script( 'woocommerce_apay' );


            add_filter("script_loader_tag", "add_module_to_my_script", 10, 3);
            function add_module_to_my_script($tag, $handle, $src){
                        if ("woocommerce_apay" === $handle) {
                            $tag = '<script type="module" src="' . esc_url($src) . '"></script>';
                        }

                        return $tag;
                    }

	
	 	}

	

		/*
		 * We're processing the payments here, everything about it is in Step 5
		 */
		public function process_payment( $order_id ) {

            global $woocommerce;
            
                // we need it to get any order detailes
                $order = wc_get_order( $order_id );
            
            
                if( true ) {
            
                    $body = json_decode( $response['body'], true );
            
                    // it could be different depending on your payment processor
                    if (true) {
            
                        // we received the payment
                        $order->payment_complete();
                        $order->reduce_order_stock();
            
                        // some notes to customer (replace true with false to make it private)
                        $order->add_order_note( 'Hey, your order is paid! Thank you!', true );
            
                        // Empty cart
                        $woocommerce->cart->empty_cart();
            
                        // Redirect to the thank you page
                        return array(
                            'result' => 'success',
                            'redirect' => $this->get_return_url( $order )
                        );
            
                    } else {
                        wc_add_notice(  'Please try again.', 'error' );
                        return;
                    }
            
                } else {
                    wc_add_notice(  'Connection error.', 'error' );
                    return;
                }
					
	 	}

		
 	}
}