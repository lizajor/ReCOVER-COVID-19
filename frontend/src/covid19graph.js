import React, { Component} from "react";
//import ReactDOM from "react-dom";
import { ResponsiveLine } from "@nivo/line";
import moment from "moment";
import numeral from "numeral";
import {
  red,
  volcano,
  orange,
  yellow,
  gold,
  lime,
  green,
  cyan,
  blue,
  geekblue,
  purple,
  magenta
} from "@ant-design/colors";


function getLineColor(index) {
  const colors = [
    red,
    gold,
    green,
    blue,
    volcano,
    yellow,
    cyan,
    purple,
    orange,
    lime,
    geekblue,
    magenta
  ];

  return colors[index % colors.length];
}

// Custom layer for Nivo Line that allows us to display predictions as dashed
// lines.
const DashedLine = ({ series, lineGenerator, xScale, yScale }) => {
  return series.map(({ id, data, color, predicted, distancing }) => {
    let style = {
      strokeWidth: 3
    };

    // Add custom style if predicted.
    if (predicted) {
      if (distancing) {
        style.strokeDasharray = "6, 4";
      } else {
        // Display a sparser pattern for no social distancing.
        style.strokeDasharray = "2, 6";
      }
    }

    return (
      <path
        key={id}
        d={lineGenerator(
          data.map(d => ({
            x: xScale(d.data.x),
            y: yScale(d.data.y)
          }))
        )}
        fill="none"
        stroke={color}
        style={style}
      />
    );
  });
};

const theme = {
  axis: {
    ticks: {
      text: {
        fontSize: 16
      }
    },
    legend: {
      text: {
        fontSize: 16
      }
    }
  },
  legends: {
    text: {
      fontSize: 14
    }
  }
};

class Covid19Graph extends Component {
  ////////////////////////////////////
constructor(props) {
  super(props);
  this.state = { width: 0, height: 0 };
  this.updateWindowDimensions = this.updateWindowDimensions.bind(this);
}

componentDidMount() {
  this.updateWindowDimensions();
  window.addEventListener('resize', this.updateWindowDimensions);
}

componentWillUnmount() {
  window.removeEventListener('resize', this.updateWindowDimensions);
}

updateWindowDimensions() {
  this.setState({ width: window.innerWidth, height: window.innerHeight });
}

  ////////////////////////////////////


  parseDate(dateStr) {
    let [year, month, day] = dateStr.split("-").map(Number);
    // Month in JS is 0-based.
    month -= 1;
    return new Date(year, month, day);
  }

  /**
   * Given a time series returned by the predict endpoint, getCumulativeData
   * returns it in Nivo format.
   */
  getCumulativeData(data, normalizer) {
    return data.map(d => ({
      x: this.parseDate(d.date),
      y: d.value/normalizer
    }));
  }

  /**
   * Given a time series returned by the predict endpoint, getDeltaData returns
   * the adjacent difference of the timeseries, in Nivo format.
   * @param initialVal - The initial value that is subtracted from the 1st
   *  element.
   */
  getDeltaData(data, initialVal, normalizer) {
    return data.map((d, i) => {
      if (i === 0) {
        return {
          x: this.parseDate(d.date),
          y: (d.value - initialVal)/normalizer
        };
      }

      return {
        x: this.parseDate(d.date),
        y: (d.value - data[i - 1].value)/normalizer
      };
    });
  }

  // processData properly formats the given data, and performs special
  // operations based on parameter values.
  processData(data, params) {
    const { statistic, yScale, initialVal, normalizer } = params;

    // Determine whether we need to calculate deltas between points.
    let retData =
      statistic === "delta"
        ? this.getDeltaData(data, initialVal, normalizer)
        : this.getCumulativeData(data, normalizer);

    // Remove all points with y = 0 if we're using log scale, otherwise it will
    // break.
    if (yScale === "log") {
      retData = retData.filter(({ x, y }) => y > 0);
    }

    return retData;
  }

  /**
   * getDataMax returns the maximum value present in the data supplied to the
   * graph.
   */
  getDataMax() {
    const { data } = this.props;

    let max = 0;

    Object.keys(data).forEach(area => {
      const { observed, predictions } = data[area];
      max = Math.max(max, Math.max(...observed.map(({ value }) => value)));

      predictions.forEach(p => {
        const timeSeries = p.time_series;
        max = Math.max(max, Math.max(...timeSeries.map(({ value }) => value)));
      });
    });

    return max;
  }

  /**
   * getYAxisProps returns the corresponding Nivo line props for supporting
   * different Y axis types (linear and log).
   */
  getYAxisProps() {
    const { statistic, yScale } = this.props;

    const linearAxisLeft = {
      // Format large y numbers as their abbreviations.
      format: y => numeral(y).format("0.[0]a"),
      orient: "left",
      tickSize: 5,
      tickPadding: 5,
      tickRotation: 0,
      legend: statistic === "delta" ? "New Cases" : "Cumulative Cases",
      legendOffset: -60,
      legendPosition: "middle"
    };

    let logTickValues = [];
    for (let i = 0; i <= Math.ceil(Math.log10(this.getDataMax())); i++) {
      logTickValues.push(Math.pow(10, i));
    }

    // The 'axisLeft' prop for log scale is the same as for linear axis, except
    // that the tick values must be supplied.
    const logAxisLeft = {
      ...linearAxisLeft,
      tickValues: logTickValues
    };

    // For log scale Y axes, we must supply the Y tick values for the grid, as
    // well as specifying the min/ max, since it seems like Nivo cannot
    // automatically determine the domain for log scale.
    if (yScale === "log") {
      return {
        axisLeft: logAxisLeft,
        gridYValues: logTickValues,
        yScale: {
          type: "log",
          base: 10,
          min: Math.min(...logTickValues),
          max: Math.max(...logTickValues)
        }
      };
    }

    return {
      axisLeft: linearAxisLeft,
      yScale: {
        type: "linear",
        min: "auto",
        max: "auto"
      }
    };
  }

  render() {

    let { data } = this.props;
    const { statistic, yScale, dataType } = this.props;
    // chartData contains the data that we will pass into Nivo line chart.
    let chartData = [];
    // colors holds hex values for each line in the chart.
    let colors = [];

    // Sort the data by area name (so we have a consistent coloring) and then
    // loop over each area.
    Object.keys(data)
      .sort()
      .forEach((area, idx) => {
        const lineColor = getLineColor(idx);
        const observedConfirmed = data[area].observed;
        const observedDeath = data[area].observed_deaths;
        const normalizer = data[area].normalizer;
        // Add the observed infection data if confirmed is selected
        if (dataType.includes("confirmed"))
        {
          chartData.push({
            id: area,
            data: this.processData(observedConfirmed, {
              statistic: statistic,
              yScale: yScale,
              initialVal: 0,
              normalizer: normalizer
            }),
            // 'predicted' is a custom prop that we add so later we can tell the
            // difference between observed/predicted data when drawing the lines.
            predicted: false
          });
  
          colors.push(lineColor[4]);
        }
        if (dataType.includes("death"))
        {
          //also push death value to the same graph
          chartData.push({
            id: `${area} death`,
            data: this.processData(observedDeath, {
              statistic: statistic,
              yScale: yScale,
              initialVal: 0,
              normalizer
            }),
            // 'predicted' is a custom prop that we add so later we can tell the
            // difference between observed/predicted data when drawing the lines.
            predicted: false
          });

          colors.push(lineColor[6])
        }
        
        // Add the data for each of the predicted time series. Filter out time
        // series that don't have any data associated.
        data[area].predictions
          .filter(p => p.time_series.length > 0)
          .forEach((p,idx) => {
            const modelName = p.model.name;
            const isDeathModel = modelName.substring(0, 10) !== "SI-kJalpha" || modelName.includes("death prediction")
            const distancing = p.distancing;
            const timeSeries = p.time_series;
            //check if the model is a death model
            let augmented_timeSeries = []
            if (dataType.includes("death") && isDeathModel)
            {
              augmented_timeSeries = [observedDeath[observedDeath.length - 1]].concat(timeSeries);
            }
            else if (dataType.includes("confirmed") && !isDeathModel)
            {
              augmented_timeSeries = [observedConfirmed[observedConfirmed.length - 1]].concat(timeSeries);
            }
            else
            {
              return
            }

            console.log(observedConfirmed);
            console.log(augmented_timeSeries);


            chartData.push({
              id: `${area} (${modelName}, ${distancing})`,
              // If we're displaying deltas, we pass in the last observed value as
              // the initial value for calculating the predicted deltas.
              data: this.processData(augmented_timeSeries, {
                statistic: statistic,
                yScale: yScale,
                initialVal: isDeathModel?observedDeath[observedDeath.length - 2].value:observedConfirmed[observedConfirmed.length - 2].value,
                normalizer: normalizer
              }),
              // 'predicted' is a custom prop that we add so later we can tell the
              // difference between observed/predicted data when drawing the lines.
              predicted: true,
              // 'distancing' is also a custom prop we add so we can draw the
              // line patterns differently between yes/no social distancing.
              distancing: distancing
            });
            if (idx <= 4)
            {
              colors.push(lineColor[4+idx]);
            }
            else if (idx <= 8)
            {
              colors.push(lineColor[8 - idx]);

            }
            else 
            {
              colors.push(lineColor[idx%10]);
            }
          });
      });

    // Determine whether we need to show weeks or months on the X axis.
    let tickValues = "every week";

    if (chartData.length > 0) {
      // Calculate the minimum and maximum dates present in the data.
      let minDate = chartData[0].data[0].x;
      let maxDate = chartData[0].data[0].x;

      chartData.forEach(({ data }) => {
        data.forEach(({ x }) => {
          minDate = Math.min(minDate, x);
          maxDate = Math.max(maxDate, x);
        });
      });

      minDate = moment(minDate);
      maxDate = moment(maxDate);

      // Switch to 'every month' if the date range is over a certain threshold.
      const diffInDays = maxDate.diff(minDate, "days");
      if (diffInDays > 15) {
        tickValues = "every month";
      }
    }
    
    const num_ticks = 1 + this.state.width/300;
    return (

      <ResponsiveLine
        data={chartData}
        colors={colors}
        //50,50,50,80
        margin={{ top: 10, right: 50, bottom: 70, left: 100 }}
        xScale={{
          type: "time",
          format: "native",
          precision: "day"
        }}
        axisBottom={{
          // tickValues determines how often / with what values our 'format'
          // func is called.
          //tickValues: tickValues,
          tickValues: num_ticks,
          // A custom 'format' func is required since all the x values are
          // javascript Date objects.
          format: date => {
            return moment(date).format("M/D");
          },
          orient: "bottom",
          tickSize: 5,
          tickPadding: 5,
          tickRotation: 0,
          legend: "Date",
          legendOffset: 36,
          legendPosition: "middle"
        }}
        // Set up the Y axis.
        {...this.getYAxisProps()}
        enableSlices="x"
        sliceTooltip={({ slice }) => {
          return (
            <div
              style={{
                background: "white",
                padding: "9px 12px",
                border: "1px solid #ccc"
              }}
            >
              <div>
                {// Grab the date from the first point, this will be the title of
                // the tooltip.
                moment(slice.points[0].data.x).format("MMM Do YYYY")}
              </div>
              {slice.points.map(point => (
                <div
                  key={point.id}
                  style={{
                    color: point.serieColor,
                    padding: "3px 0"
                  }}
                >
                  <strong>{point.serieId}</strong>[
                  {numeral(point.data.yFormatted).format("0.[0]a")}]
                </div>
              ))}
            </div>
          );
        }}
        pointSize={0}
        pointLabel="y"
        pointLabelYOffset={-12}
        legends={[
          {
            anchor: "top-left",
            direction: "column",
            justify: false,
            translateX: 0,
            translateY: 0,
            itemsSpacing: 0,
            itemDirection: "left-to-right",
            itemWidth: 80,
            itemHeight: 20,
            itemOpacity: 0.75,
            symbolSize: 12,
            symbolShape: "circle",
            symbolBorderColor: "rgba(0, 0, 0, .5)",
            effects: [
              {
                on: "hover",
                style: {
                  itemBackground: "rgba(0, 0, 0, .03)",
                  itemOpacity: 1
                }
              }
            ]
          }
        ]}
        layers={[
          "grid",
          "markers",
          "areas",
          "crosshair",
          DashedLine,
          "slices",
          "points",
          "axes",
          "legends"
        ]}
        theme={theme}
      />
    );
  }
}

export default Covid19Graph;
