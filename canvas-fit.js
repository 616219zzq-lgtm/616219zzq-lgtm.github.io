// Scale the complete 1920 × 960 composition into the available viewport.
(function () {
  var stage = document.getElementById('stage');
  function fitCanvas() {
    var viewport = window.visualViewport;
    var width = viewport ? viewport.width : window.innerWidth;
    var height = viewport ? viewport.height : window.innerHeight;
    stage.style.zoom = Math.min(width / 1920, height / 960);
  }
  fitCanvas();
  window.addEventListener('resize', fitCanvas);
  if (window.visualViewport) window.visualViewport.addEventListener('resize', fitCanvas);
})();
