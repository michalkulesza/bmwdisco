import { Children, Fragment, type ReactNode } from 'react';
import { View } from 'react-native';

interface ListGroupProps {
  children: ReactNode;
}

const ListGroup = ({ children }: ListGroupProps) => {
  const rows = Children.toArray(children);

  return (
    <View className="overflow-hidden rounded-card border border-card-border bg-card">
      {rows.map((row, index) => (
        <Fragment key={index}>
          {index > 0 ? <View className="ml-4 h-px bg-card-border" /> : null}
          {row}
        </Fragment>
      ))}
    </View>
  );
};

export default ListGroup;
