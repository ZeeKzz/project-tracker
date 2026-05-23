//main.js - Project Tracker
console.log("Project Tracker loaded.");

document.querySelectorAll('.clickable-row').forEach(row => {
    row.addEventListener('click', function() {
        window.location = this.dataset.href;
    });
});