'use client';
import { Icon } from './Icon';
export default function PrintButton() { return <button className="btn-ghost" onClick={() => window.print()}><Icon name="print" size={16} />Print</button>; }
