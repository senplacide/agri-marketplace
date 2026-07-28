(function() {
    var options = document.querySelectorAll('.role-option');
    if (!options.length) return;

    function updateRoleStyles() {
        options.forEach(function(opt) {
            var radio = opt.querySelector('input[type="radio"]');
            if (radio.checked) {
                opt.style.borderColor = '#2E7D32';
                opt.style.background = '#f0fdf4';
            } else {
                opt.style.borderColor = '#e0e0e0';
                opt.style.background = 'transparent';
            }
        });
    }

    options.forEach(function(opt) {
        opt.addEventListener('click', function() {
            var radio = opt.querySelector('input[type="radio"]');
            radio.checked = true;
            updateRoleStyles();
        });
    });

    updateRoleStyles();
})();
