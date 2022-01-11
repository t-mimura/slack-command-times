function drawPieChart(dataset, selectorText) {
  /*
   * 引数のdatasetの形式は次の通りを想定
   * [
   *   { taskName: 'hoge', totalTime: 200, rate: 40 },
   *   { taskName: 'fuga', totalTime: 300, rate: 60 }
   * ]
   */
  /* -------------------------------定数/変数定義---------------------------------------------*/
  var graphSize = 300;
  var graphMargin = 20;
  var height = graphSize;
  var width = graphSize;
  var radius = (graphSize - graphMargin) / 2;
  var colors = [
      '#8BD5DF', '#C3DECC', '#EAE6BC', '#F78F21', '#FC7100', '#8CF349', '#DDEC62', '#A99CE3', '#EA54BC', '#DAA52D',
      /*'#0B8341', '#B5F314', '#FDC6F8', '#F88C29', '#75F978', '#D695D6', '#F66CB9', '#FC78FF', '#3EBA3E', '#0BD6A5'*/];
  var colorScale = d3.scaleOrdinal(colors);
  /* -------------------------------関数定義---------------------------------------------*/
  var combineSubordinates = function(_dataset, resultCount) {
      var rv = [];
      var othersTotalTime = 0;
      var wholeTotalTime = 0;
      // いったんtotalTimeの降順にする
      _dataset = _dataset.sort(function(arg1, arg2) {
          return arg2.totalTime - arg1.totalTime;
      });
      _dataset.forEach(function(data) {
          if (rv.length < resultCount - 1) {
              rv.push(data);
          } else {
              othersTotalTime += data.totalTime;
          }
          wholeTotalTime += data.totalTime;
      }, this);
      // taskNameでソートする
      rv = rv.sort(function(arg1, arg2) {
          return arg1.taskName.localeCompare(arg2.taskName);
      });
      if (othersTotalTime > 0) {
          rv.push({
              taskName: 'others',
              totalTime: othersTotalTime,
              rate: Math.floor(othersTotalTime / wholeTotalTime)
          });
      }
      return rv;
  };
  /* -------------------------------D3処理---------------------------------------------*/
  dataset = combineSubordinates(dataset, colors.length);
  var tooltip = d3.select('span#tooltip');
  var svg = d3.select(selectorText).append('svg')
      .attr('class', 'graph')
      .attr('height', height)
      .attr('width', width);
  var graphGroup = svg.append('g')
      .attr('transform', 'translate(' + graphSize / 2 + ',' + graphSize / 2 + ')');
  var arc = d3.arc()
      .outerRadius(radius)
      .innerRadius(0);
  var pie = d3.pie()
      .sort(null)
      .value(function(d) { return d.totalTime; });
  var graphParts = graphGroup.selectAll('g')
      .data(pie(dataset))
      .enter()
      .append('g');
  var arcs = graphParts.append('path')
      .attr('d', arc)
      .attr('fill', function(d) {
          return colorScale(d.data.taskName);
      })
      .on('mouseover', function(d) { return tooltip.style('visibility', 'visible').html(d.data.taskName); })
      .on('mousemove', function(d) { return tooltip.style('top', (event.pageY - 20)+ 'px').style('left', (event.pageX - 10) + 'px'); })
      .on('mouseout', function(d) { return tooltip.style('visibility', 'hidden'); });
  var texts = graphParts.append('text')
      .attr('transform', function(d) { return 'translate(' + arc.centroid(d) + ')'; })
      .attr('text-anchor', 'middle')
      .text(function(d) {
        // 面積が狭いので、割合が3％以下のものは表示しない
        if (d.data.rate > 3) {
          return d.data.rate + '%';
        } else {
          return '';
        }
      });
  /* -------------------------------D3凡例処理---------------------------------------------*/
  var legendDiv = d3.select(selectorText).append('div')
      .attr('class', 'legend');
  var legendParts = legendDiv.selectAll('div')
      .data(dataset)
      .enter()
      .append('div');
  var legendRects = legendParts.append('span')
      .attr('style', function(d) { return 'color:' + colorScale(d.taskName); })
      .text('■ ');
  var legendTexts = legendParts.append('span')
      .html(function(d) { return d.taskName; });
}
