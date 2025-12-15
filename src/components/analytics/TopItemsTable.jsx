import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { TrendingUp, User, Music } from 'lucide-react';
import { Link } from 'react-router-dom';

const TopItemsTable = ({ tracks, creators, title, icon }) => {
  const items = tracks || creators || [];
  const isTrackTable = !!tracks;

  if (!items || items.length === 0) {
    return (
      <Card className="glass-effect-light">
        <CardHeader>
          <CardTitle className="golden-text flex items-center">{icon || <TrendingUp className="mr-2 h-6 w-6 text-yellow-400"/>}{title}</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-center text-gray-400 py-8">No data available for {title.toLowerCase()}.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="glass-effect-light">
      <CardHeader>
        <CardTitle className="golden-text flex items-center">{icon || <TrendingUp className="mr-2 h-6 w-6 text-yellow-400"/>}{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[50px]">#</TableHead>
              <TableHead>{isTrackTable ? 'Track Title' : 'Creator Name'}</TableHead>
              <TableHead className="text-right">Streams</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.map((item, index) => (
              <TableRow key={item.track_id || item.creator_id || index}>
                <TableCell className="font-medium text-gray-500">{index + 1}</TableCell>
                <TableCell>
                  {isTrackTable && item.track_id && item.track_title ? (
                     <Link to={`/track/${item.track_id}`} className="hover:text-yellow-300 transition-colors proximity-glow-link-xs flex items-center">
                      <Music size={14} className="mr-2 opacity-70"/> {item.track_title}
                    </Link>
                  ) : (item.creator_name && item.creator_id) ? (
                     <Link to={`/creator/${item.creator_id}`} className="hover:text-yellow-300 transition-colors proximity-glow-link-xs flex items-center">
                       <User size={14} className="mr-2 opacity-70"/> {item.creator_name}
                     </Link>
                  ) : (
                    item.track_title || item.creator_name || 'N/A'
                  )}
                </TableCell>
                <TableCell className="text-right font-semibold text-green-400">
                  {item.stream_count ? item.stream_count.toLocaleString() : 'N/A'}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
};

export default TopItemsTable;
