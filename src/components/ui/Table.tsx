import React from 'react';
import './ui.css';

interface TableContainerProps extends React.HTMLAttributes<HTMLDivElement> {}

export const TableContainer: React.FC<TableContainerProps> = ({ className = '', children, ...props }) => {
  const classes = `ui-table-container ${className}`.trim();
  return (
    <div className={classes} {...props}>
      <div className="ui-table-scroll">
        {children}
      </div>
    </div>
  );
};

interface UITableProps extends React.TableHTMLAttributes<HTMLTableElement> {
  minWidth?: number | string;
}

export const UITable: React.FC<UITableProps> = ({ minWidth = '650px', className = '', style, children, ...props }) => {
  const classes = `ui-table ${className}`.trim();
  const mergedStyle: React.CSSProperties = {
    minWidth,
    ...style,
  };

  return (
    <table className={classes} style={mergedStyle} {...props}>
      {children}
    </table>
  );
};

interface UITableHeadRowProps extends React.HTMLAttributes<HTMLTableRowElement> {}

export const UITableHeadRow: React.FC<UITableHeadRowProps> = ({ className = '', children, ...props }) => {
  const classes = `ui-table-head-row ${className}`.trim();
  return <tr className={classes} {...props}>{children}</tr>;
};

interface UITableHeadCellProps extends React.ThHTMLAttributes<HTMLTableCellElement> {
  align?: 'left' | 'center' | 'right';
}

export const UITableHeadCell: React.FC<UITableHeadCellProps> = ({ align = 'left', className = '', children, ...props }) => {
  const classes = `ui-table-head-cell ui-table-head-cell--${align} ${className}`.trim();
  return (
    <th scope="col" className={classes} {...props}>
      {children}
    </th>
  );
};
