import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

interface StageData {
  stage: string;
  count: number;
  avg_days?: number;
}

interface Props {
  data: StageData[];
  onBarClick?: (stage: string) => void;
}

export default function PipelineFlow({ data, onBarClick }: Props) {
  if (!data || data.length === 0) {
    return <p className="text-sm text-gray-500 text-center py-8">No pipeline data available.</p>;
  }

  return (
    <ResponsiveContainer width="100%" height={300}>
      <BarChart data={data} layout="vertical" margin={{ top: 5, right: 20, left: 80, bottom: 5 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
        <XAxis type="number" tick={{ fontSize: 12 }} />
        <YAxis type="category" dataKey="stage" tick={{ fontSize: 11 }} width={75} />
        <Tooltip formatter={(value: number, name: string) =>
          name === 'count' ? `${value} requests` : `${value} days`
        } />
        <Bar
          dataKey="count"
          fill="#337ab7"
          name="Requests"
          radius={[0, 4, 4, 0]}
          cursor={onBarClick ? 'pointer' : undefined}
          onClick={onBarClick ? (_data: StageData) => onBarClick(_data.stage) : undefined}
        />
      </BarChart>
    </ResponsiveContainer>
  );
}
