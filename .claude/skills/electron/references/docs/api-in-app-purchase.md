# Source: https://www.electronjs.org/docs/latest/api/in-app-purchase

On this page

> In-app purchases on Mac App Store.

Process: [Main](/docs/latest/glossary#main-process)

## Events[â](#events "Direct link to Events")

The `inAppPurchase` module emits the following events:

### Event: 'transactions-updated'[â](#event-transactions-updated "Direct link to Event: 'transactions-updated'")

Returns:

* `event` Event
* `transactions` Transaction[] - Array of [Transaction](/docs/latest/api/structures/transaction) objects.

Emitted when one or more transactions have been updated.

## Methods[â](#methods "Direct link to Methods")

The `inAppPurchase` module has the following methods:

### `inAppPurchase.purchaseProduct(productID[, opts])`[â](#inapppurchasepurchaseproductproductid-opts "Direct link to inapppurchasepurchaseproductproductid-opts")

* `productID` string
* `opts` Integer | Object (optional) - If specified as an integer, defines the quantity.
+ `quantity` Integer (optional) - The number of items the user wants to purchase.
+ `username` string (optional) - The string that associates the transaction with a user account on your service (applicationUsername).

Returns `Promise<boolean>` - Returns `true` if the product is valid and added to the payment queue.

You should listen for the `transactions-updated` event as soon as possible and certainly before you call `purchaseProduct`.

### `inAppPurchase.getProducts(productIDs)`[â](#inapppurchasegetproductsproductids "Direct link to inapppurchasegetproductsproductids")

* `productIDs` string[] - The identifiers of the products to get.

Returns `Promise<Product[]>` - Resolves with an array of [Product](/docs/latest/api/structures/product) objects.

Retrieves the product descriptions.

### `inAppPurchase.canMakePayments()`[â](#inapppurchasecanmakepayments "Direct link to inapppurchasecanmakepayments")

Returns `boolean` - whether a user can make a payment.

### `inAppPurchase.restoreCompletedTransactions()`[â](#inapppurchaserestorecompletedtransactions "Direct link to inapppurchaserestorecompletedtransactions")

Restores finished transactions. This method can be called either to install purchases on additional devices, or to restore purchases for an application that the user deleted and reinstalled.

[The payment queue](https://developer.apple.com/documentation/storekit/skpaymentqueue?language=objc) delivers a new transaction for each previously completed transaction that can be restored. Each transaction includes a copy of the original transaction.

### `inAppPurchase.getReceiptURL()`[â](#inapppurchasegetreceipturl "Direct link to inapppurchasegetreceipturl")

Returns `string` - the path to the receipt.

### `inAppPurchase.finishAllTransactions()`[â](#inapppurchasefinishalltransactions "Direct link to inapppurchasefinishalltransactions")

Completes all pending transactions.

### `inAppPurchase.finishTransactionByDate(date)`[â](#inapppurchasefinishtransactionbydatedate "Direct link to inapppurchasefinishtransactionbydatedate")

* `date` string - The ISO formatted date of the transaction to finish.

Completes the pending transactions corresponding to the date.

* [Events](#events)
+ [`'transactions-updated'`](#event-transactions-updated)* [Methods](#methods)
+ [`purchaseProduct`](#inapppurchasepurchaseproductproductid-opts)+ [`getProducts`](#inapppurchasegetproductsproductids)+ [`canMakePayments`](#inapppurchasecanmakepayments)+ [`restoreCompletedTransactions`](#inapppurchaserestorecompletedtransactions)+ [`getReceiptURL`](#inapppurchasegetreceipturl)+ [`finishAllTransactions`](#inapppurchasefinishalltransactions)+ [`finishTransactionByDate`](#inapppurchasefinishtransactionbydatedate)