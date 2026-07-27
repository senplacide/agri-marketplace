// =====================================================
// AgriConnect Currency Conversion Utility
// =====================================================
// Centralized exchange rate and dual-currency formatting.
// Update EXCHANGE_RATE below when the rate changes.
// =====================================================

var CurrencyConfig = {
    EXCHANGE_RATE: 1400,
    CURRENCY_SYMBOL: '$',
    CURRENCY_CODE: 'USD',
    PRIMARY_CURRENCY: 'RWF'
};

var PriceFormatter = {
    rwf: new Intl.NumberFormat('en-RW', { style: 'currency', currency: 'RWF' }),

    formatRwf: function (price) {
        return Number(price).toLocaleString('en-RW');
    },

    convertToUSD: function (rwfPrice) {
        return Number(rwfPrice) / CurrencyConfig.EXCHANGE_RATE;
    },

    formatUSD: function (rwfPrice) {
        var usd = this.convertToUSD(rwfPrice);
        return CurrencyConfig.CURRENCY_SYMBOL + usd.toFixed(2) + ' ' + CurrencyConfig.CURRENCY_CODE;
    },

    formatDual: function (rwfPrice) {
        var rwf = this.formatRwf(rwfPrice);
        var usd = this.convertToUSD(rwfPrice).toFixed(2);
        return '<span class="price-rwf">' + rwf + ' <span class="price-currency">' + CurrencyConfig.PRIMARY_CURRENCY + '</span></span>' +
            '<span class="price-usd">\u2248 ' + CurrencyConfig.CURRENCY_SYMBOL + usd + ' ' + CurrencyConfig.CURRENCY_CODE + '</span>';
    },

    formatDualText: function (rwfPrice) {
        var rwf = this.formatRwf(rwfPrice);
        var usd = this.convertToUSD(rwfPrice).toFixed(2);
        return rwf + ' ' + CurrencyConfig.PRIMARY_CURRENCY + '\n\u2248 ' + CurrencyConfig.CURRENCY_SYMBOL + usd + ' ' + CurrencyConfig.CURRENCY_CODE;
    },

    formatDualInline: function (rwfPrice) {
        var rwf = this.formatRwf(rwfPrice);
        var usd = this.convertToUSD(rwfPrice).toFixed(2);
        return rwf + ' ' + CurrencyConfig.PRIMARY_CURRENCY + ' (\u2248 ' + CurrencyConfig.CURRENCY_SYMBOL + usd + ' ' + CurrencyConfig.CURRENCY_CODE + ')';
    },

    formatDualCompact: function (rwfPrice) {
        var rwf = this.formatRwf(rwfPrice);
        var usd = this.convertToUSD(rwfPrice).toFixed(2);
        return '<span class="price-rwf">' + rwf + ' ' + CurrencyConfig.PRIMARY_CURRENCY + '</span>' +
            '<span class="price-usd">\u2248 ' + CurrencyConfig.CURRENCY_SYMBOL + usd + ' ' + CurrencyConfig.CURRENCY_CODE + '</span>';
    }
};
