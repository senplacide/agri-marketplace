document.addEventListener('DOMContentLoaded', function() {
    var hamburger = document.getElementById('navHamburger');
    var navCenter = document.getElementById('navCenter');
    var navRight = document.getElementById('navRight');
    if (hamburger && navCenter && navRight) {
        hamburger.addEventListener('click', function() {
            navCenter.classList.toggle('open');
            navRight.classList.toggle('open');
            var icon = hamburger.querySelector('i');
            if (navCenter.classList.contains('open')) {
                icon.className = 'fa-solid fa-xmark';
            } else {
                icon.className = 'fa-solid fa-bars';
            }
        });
    }
});
