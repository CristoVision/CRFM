import React from 'react';
import { Line } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler
} from 'chart.js';
import { format } from 'date-fns';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler
);

const StreamChart = ({ data }) => {
  const chartData = {
    labels: data.map(item => format(new Date(item.date), 'MMM d')),
    datasets: [
      {
        label: 'Streams',
        data: data.map(item => item.streams),
        borderColor: '#f0c348', // Gold
        backgroundColor: 'rgba(240, 195, 72, 0.2)', // Lighter gold with transparency
        tension: 0.3,
        fill: true,
        pointBackgroundColor: '#d4af37', // Darker gold for points
        pointBorderColor: '#0a0a0a', // Almost black
        pointHoverBackgroundColor: '#fff',
        pointHoverBorderColor: '#f0c348',
      },
    ],
  };

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'top',
        labels: {
          color: '#e5e7eb', // text-gray-200
          font: {
            family: 'Montserrat, sans-serif',
          }
        }
      },
      title: {
        display: false, // Already have a card title
      },
      tooltip: {
        backgroundColor: 'rgba(0, 0, 0, 0.8)',
        titleColor: '#f0c348',
        bodyColor: '#e5e7eb',
        borderColor: '#f0c348',
        borderWidth: 1,
        padding: 10,
        callbacks: {
          label: function(context) {
            return `Streams: ${context.parsed.y}`;
          }
        }
      }
    },
    scales: {
      x: {
        ticks: {
          color: '#9ca3af', // text-gray-400
           font: {
            family: 'Montserrat, sans-serif',
          }
        },
        grid: {
          color: 'rgba(255, 255, 255, 0.1)', // Lighter grid lines
        },
      },
      y: {
        ticks: {
          color: '#9ca3af', // text-gray-400
          font: {
            family: 'Montserrat, sans-serif',
          },
          beginAtZero: true,
          stepSize: 1, // Ensure whole numbers for stream counts
        },
        grid: {
          color: 'rgba(255, 255, 255, 0.1)',
        },
      },
    },
    interaction: {
      mode: 'index',
      intersect: false,
    },
  };

  return <Line options={options} data={chartData} />;
};

export default StreamChart;
