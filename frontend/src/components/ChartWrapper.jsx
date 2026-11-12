import { useMemo, useRef } from 'react'
import { Chart } from 'react-google-charts'

export default function ChartWrapper({ field, data, totalResponses }) {
  const chartRef = useRef(null)
  const { chartType, chartData, options } = useMemo(() => {
    // Handle no data case
    if (!data || field.chart_type === 'none') {
      return { chartType: null, chartData: null, options: null }
    }

    switch (field.chart_type) {
      case 'pie':
        return getPieChartData(data, field)
      
      case 'bar':
        return getBarChartData(data, field)
      
      case 'column':
        return getColumnChartData(data, field)
      
      case 'text_list':
        return { chartType: 'text_list', chartData: data.values || [], options: null }
      
      default:
        return { chartType: null, chartData: null, options: null }
    }
  }, [field, data, totalResponses])

  // Show "no data" message if no chart type or no data
  if (!chartType || (!chartData && chartType !== 'text_list')) {
    return (
      <div className="text-center py-8 text-gray-500">
        Chưa có dữ liệu để hiển thị
      </div>
    )
  }

  if (chartType === 'text_list') {
    return (
      <div className="space-y-2 max-h-64 overflow-y-auto">
        {chartData && chartData.length > 0 ? (
          chartData.map((text, index) => (
            <div key={index} className="p-2 bg-gray-50 rounded border border-gray-200 text-sm">
              {text}
            </div>
          ))
        ) : (
          <div className="text-center py-4 text-gray-500">Chưa có câu trả lời</div>
        )}
      </div>
    )
  }

  // Check if chart data is valid (has more than just header row)
  if (!chartData || chartData.length <= 1) {
    return (
      <div className="text-center py-8 text-gray-500">
        Chưa có dữ liệu để hiển thị
      </div>
    )
  }

  return (
    <div className="w-full">
      <div ref={chartRef} className="w-full">
        <Chart
          chartType={chartType}
          data={chartData}
          options={options}
          width="100%"
          height={300}
          legendToggle
        />
      </div>
    </div>
  )
}

function getPieChartData(data, field) {
  const chartData = [['Lựa chọn', 'Số lượng']]
  
  if (data.chart_data && data.chart_data.length > 0) {
    data.chart_data.forEach(item => {
      chartData.push([item.label, item.value])
    })
  } else {
    return { chartType: null, chartData: null, options: null }
  }

  const options = {
    title: '',
    pieHole: 0.4,
    colors: [
      '#4285F4', '#EA4335', '#FBBC04', '#34A853', '#FF6D00',
      '#9C27B0', '#00BCD4', '#FFC107', '#4CAF50', '#F44336'
    ],
    legend: {
      position: 'right',
      alignment: 'center',
    },
    pieSliceText: 'percentage',
    tooltip: {
      text: 'percentage'
    },
    chartArea: {
      left: 0,
      top: 0,
      width: '70%',
      height: '90%'
    },
    height: 300
  }

  return {
    chartType: 'PieChart',
    chartData,
    options
  }
}

function getBarChartData(data, field) {
  const chartData = [['Lựa chọn', 'Số lượng', { role: 'annotation' }]]
  
  if (data.chart_data && data.chart_data.length > 0) {
    data.chart_data.forEach(item => {
      chartData.push([
        item.label,
        item.value,
        `${item.value} (${item.percentage}%)`
      ])
    })
  } else {
    return { chartType: null, chartData: null, options: null }
  }

  const maxValue = data.chart_data && data.chart_data.length > 0 
    ? Math.max(...data.chart_data.map(item => item.value)) 
    : 0

  const options = {
    title: '',
    colors: ['#4285F4'],
    legend: { position: 'none' },
    hAxis: {
      title: 'Số lượng',
      minValue: 0,
      maxValue: maxValue > 0 ? Math.ceil(maxValue * 1.2) : 10,
    },
    vAxis: {
      title: 'Lựa chọn',
    },
    bar: {
      groupWidth: '75%'
    },
    annotations: {
      textStyle: {
        fontSize: 11,
        color: '#374151',
        bold: true,
      },
      alwaysOutside: false,
      stem: {
        length: 0
      }
    },
    chartArea: {
      left: 120,
      top: 20,
      width: '75%',
      height: '85%'
    },
    height: 300
  }

  return {
    chartType: 'BarChart',
    chartData,
    options
  }
}

function getColumnChartData(data, field) {
  if (!data.grid_data || !data.rows || !data.columns) {
    return { chartType: null, chartData: null, options: null }
  }

  // Prepare data for column chart (stacked)
  const chartData = [['Câu hỏi', ...data.columns]]
  
  data.rows.forEach(row => {
    const rowData = [row]
    data.columns.forEach(col => {
      rowData.push(data.grid_data[row][col] || 0)
    })
    chartData.push(rowData)
  })

  const options = {
    title: '',
    colors: [
      '#4285F4', '#EA4335', '#FBBC04', '#34A853', '#FF6D00',
      '#9C27B0', '#00BCD4', '#FFC107', '#4CAF50', '#F44336'
    ],
    legend: {
      position: 'top',
      alignment: 'center',
    },
    hAxis: {
      title: 'Câu hỏi',
    },
    vAxis: {
      title: 'Số lượng',
      minValue: 0,
    },
    isStacked: true,
    chartArea: {
      left: 80,
      top: 50,
      width: '75%',
      height: '75%'
    },
    height: 300
  }

  return {
    chartType: 'ColumnChart',
    chartData,
    options
  }
}

