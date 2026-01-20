# Source: https://www.electronjs.org/docs/latest/api/structures/product-discount

* `identifier` string - A string used to uniquely identify a discount offer for a product.
* `type` number - The type of discount offer.
* `price` number - The discount price of the product in the local currency.
* `priceLocale` string - The locale used to format the discount price of the product.
* `paymentMode` string - The payment mode for this product discount. Can be `payAsYouGo`, `payUpFront`, or `freeTrial`.
* `numberOfPeriods` number - An integer that indicates the number of periods the product discount is available.
* `subscriptionPeriod` [ProductSubscriptionPeriod](/docs/latest/api/structures/product-subscription-period) (optional) - An object that defines the period for the product discount.