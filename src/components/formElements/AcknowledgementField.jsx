import React from 'react';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { cn } from '@/lib/utils';

const AcknowledgementField = ({ checked, onChange, error, idPrefix = '' }) => {
  return (
    <div className="space-y-2 pt-4 border-t border-white/10">
      <div className="flex items-start space-x-2">
        <Checkbox
          id={`${idPrefix}acknowledgement`}
          name="acknowledgement"
          checked={checked}
          onCheckedChange={(isChecked) => onChange({ target: { name: 'acknowledgement', checked: isChecked, type: 'checkbox' } })}
          className={cn("border-gray-500 data-[state=checked]:bg-yellow-400 data-[state=checked]:text-black data-[state=checked]:border-yellow-500 mt-1", error && "border-red-500")}
        />
        <Label htmlFor={`${idPrefix}acknowledgement`} className="text-gray-400 text-xs cursor-pointer">
          I confirm this track/album, artwork, and lyrics are of Christian nature and that I hold full copyright. I forfeit any right to inappropriate claims or royalties outside this platform. I understand I may loose royalty claims due to failing to uphold Biblical and Jesus values, and teachings of Honoring God and by Edifying others humbly, in service and love. <span className="text-red-500">*</span>
        </Label>
      </div>
      {error && <p className="text-xs text-red-400 mt-1 pl-6">{error}</p>}
    </div>
  );
};

export default AcknowledgementField;
