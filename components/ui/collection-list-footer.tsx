/**
 * @buildpad-origin @buildpad/ui-collections/collection-list
 * @buildpad-version 0.2.0
 *
 * This file was copied from Buildpad UI Packages.
 * To update, run: npx @buildpad/cli add collection-list --overwrite
 *
 * Docs: https://buildpad.dev/components/collection-list
 */

import {
  Group,
  Pagination,
  Select,
  Text,
} from "@mantine/core";
import React from "react";

export interface CollectionListFooterProps {
  itemCountDisplay: string;
  limit: number;
  onLimitChange: (limit: number) => void;
  page: number;
  onPageChange: (page: number) => void;
  totalPages: number;
}

export const CollectionListFooter: React.FC<CollectionListFooterProps> = ({
  itemCountDisplay,
  limit,
  onLimitChange,
  page,
  onPageChange,
  totalPages,
}) => {
  return (
    <div className="collection-list-footer" data-testid="collection-list-footer">
      <Text size="sm" c="dimmed" data-testid="collection-list-footer-count">
        {itemCountDisplay}
      </Text>
      <Group gap="sm">
        <Group gap={4}>
          <Text size="xs" c="dimmed">Per page:</Text>
          <Select
            value={String(limit)}
            onChange={(value) => {
              if (value) {
                onLimitChange(Number(value));
              }
            }}
            data={["10", "25", "50", "100"]}
            size="xs"
            className="collection-list-per-page-select"
            data-testid="collection-list-per-page"
          />
        </Group>
        {totalPages > 1 && (
          <Pagination
            value={page}
            onChange={onPageChange}
            total={totalPages}
            size="sm"
            data-testid="collection-list-pagination-control"
          />
        )}
      </Group>
    </div>
  );
};
