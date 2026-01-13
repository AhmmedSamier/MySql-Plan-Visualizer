// MySQL Sample Execution Plans

const mysql_simple_index = `-> Index lookup on users using PRIMARY (id=100)  (cost=0.35 rows=1) (actual time=0.028..0.030 rows=1 loops=1)
`

const mysql_simple_index_query = `SELECT * FROM users WHERE id = 100;`

const mysql_simple_index_json = `{
  "query_block": {
    "select_id": 1,
    "cost_info": {
      "query_cost": "0.35"
    },
    "table": {
      "table_name": "users",
      "access_type": "const",
      "possible_keys": [
        "PRIMARY"
      ],
      "key": "PRIMARY",
      "used_key_parts": [
        "id"
      ],
      "key_length": "4",
      "ref": [
        "const"
      ],
      "rows_examined_per_scan": 1,
      "rows_produced_per_join": 1,
      "filtered": "100.00",
      "cost_info": {
        "read_cost": "0.25",
        "eval_cost": "0.10",
        "prefix_cost": "0.35",
        "data_read_per_join": "1K"
      },
      "used_columns": [
        "id",
        "name",
        "email",
        "created_at"
      ]
    }
  }
}`

const mysql_join_example = `-> Nested loop inner join  (cost=12.50 rows=10) (actual time=0.045..0.152 rows=5 loops=1)
    -> Filter: (orders.total > 100.00)  (cost=2.50 rows=10) (actual time=0.032..0.089 rows=5 loops=1)
        -> Index lookup on orders using idx_user_id (user_id=100)  (cost=2.50 rows=25) (actual time=0.028..0.075 rows=25 loops=1)
    -> Single-row index lookup on users using PRIMARY (id=orders.user_id)  (cost=0.25 rows=1) (actual time=0.011..0.012 rows=1 loops=5)
`

const mysql_join_query = `SELECT u.name, o.total 
FROM users u 
INNER JOIN orders o ON u.id = o.user_id 
WHERE o.total > 100;`

const mysql_join_json = `{
  "query_block": {
    "select_id": 1,
    "cost_info": {
      "query_cost": "12.50"
    },
    "nested_loop": [
      {
        "table": {
          "table_name": "orders",
          "access_type": "ref",
          "possible_keys": [
            "idx_user_id"
          ],
          "key": "idx_user_id",
          "used_key_parts": [
            "user_id"
          ],
          "key_length": "4",
          "ref": [
            "const"
          ],
          "rows_examined_per_scan": 25,
          "rows_produced_per_join": 10,
          "filtered": "40.00",
          "cost_info": {
            "read_cost": "1.50",
            "eval_cost": "1.00",
            "prefix_cost": "2.50",
            "data_read_per_join": "2K"
          },
          "used_columns": [
            "id",
            "user_id",
            "total"
          ],
          "attached_condition": "(\`orders\`.\`total\` > 100.00)"
        }
      },
      {
        "table": {
          "table_name": "users",
          "access_type": "eq_ref",
          "possible_keys": [
            "PRIMARY"
          ],
          "key": "PRIMARY",
          "used_key_parts": [
            "id"
          ],
          "key_length": "4",
          "ref": [
            "orders.user_id"
          ],
          "rows_examined_per_scan": 1,
          "rows_produced_per_join": 10,
          "filtered": "100.00",
          "cost_info": {
            "read_cost": "2.50",
            "eval_cost": "1.00",
            "prefix_cost": "6.00",
            "data_read_per_join": "1K"
          },
          "used_columns": [
            "id",
            "name"
          ]
        }
      }
    ]
  }
}`

const mysql_aggregate_example = `-> Group aggregate: sum(orders.total), count(orders.id)  (cost=45.50 rows=20) (actual time=0.125..1.234 rows=15 loops=1)
    -> Sort: orders.user_id  (cost=35.00 rows=100) (actual time=0.098..0.456 rows=100 loops=1)
        -> Filter: (sum(orders.total) > 1000.00)  (cost=25.00 rows=100) (actual time=0.045..0.234 rows=100 loops=1)
            -> Table scan on orders  (cost=10.00 rows=100) (actual time=0.012..0.089 rows=100 loops=1)
`

const mysql_aggregate_query = `SELECT user_id, COUNT(*) as order_count, SUM(total) as total_spent
FROM orders 
GROUP BY user_id 
HAVING SUM(total) > 1000;`

const mysql_aggregate_json = `{
  "query_block": {
    "select_id": 1,
    "cost_info": {
      "query_cost": "45.50"
    },
    "grouping_operation": {
      "using_temporary_table": true,
      "using_filesort": true,
      "cost_info": {
        "sort_cost": "10.00"
      },
      "table": {
        "table_name": "orders",
        "access_type": "ALL",
        "rows_examined_per_scan": 100,
        "rows_produced_per_join": 100,
        "filtered": "100.00",
        "cost_info": {
          "read_cost": "10.00",
          "eval_cost": "10.00",
          "prefix_cost": "20.00",
          "data_read_per_join": "10K"
        },
        "used_columns": [
          "user_id",
          "id",
          "total"
        ]
      }
    }
  }
}`

const mysql_subquery_example = `-> Nested loop inner join  (cost=125.50 rows=50) (actual time=0.234..2.456 rows=25 loops=1)
    -> Table scan on <subquery2>  (cost=2.50..2.50 rows=50) (actual time=0.001..0.012 rows=25 loops=1)
        -> Materialize  (cost=50.00..52.50 rows=50) (actual time=0.234..0.456 rows=25 loops=1)
            -> Filter: (orders.total > 500.00)  (cost=25.00 rows=50) (actual time=0.045..0.234 rows=25 loops=1)
                -> Table scan on orders  (cost=10.00 rows=200) (actual time=0.012..0.123 rows=200 loops=1)
    -> Single-row index lookup on users using PRIMARY (id=<subquery2>.user_id)  (cost=0.25 rows=1) (actual time=0.089..0.091 rows=1 loops=25)
`

const mysql_subquery_query = `SELECT * FROM users 
WHERE id IN (SELECT user_id FROM orders WHERE total > 500);`

const mysql_subquery_json = `{
  "query_block": {
    "select_id": 1,
    "cost_info": {
      "query_cost": "125.50"
    },
    "nested_loop": [
      {
        "table": {
          "table_name": "<subquery2>",
          "access_type": "ALL",
          "materialized_from_subquery": {
            "using_temporary_table": true,
            "query_block": {
              "select_id": 2,
              "cost_info": {
                "query_cost": "50.00"
              },
              "table": {
                "table_name": "orders",
                "access_type": "ALL",
                "rows_examined_per_scan": 200,
                "rows_produced_per_join": 50,
                "filtered": "25.00",
                "cost_info": {
                  "read_cost": "10.00",
                  "eval_cost": "20.00",
                  "prefix_cost": "30.00",
                  "data_read_per_join": "5K"
                },
                "used_columns": [
                  "user_id",
                  "total"
                ],
                "attached_condition": "(\`orders\`.\`total\` > 500.00)"
              }
            }
          }
        }
      },
      {
        "table": {
          "table_name": "users",
          "access_type": "eq_ref",
          "possible_keys": [
            "PRIMARY"
          ],
          "key": "PRIMARY",
          "used_key_parts": [
            "id"
          ],
          "key_length": "4",
          "ref": [
            "<subquery2>.user_id"
          ],
          "rows_examined_per_scan": 1,
          "rows_produced_per_join": 50,
          "filtered": "100.00",
          "cost_info": {
            "read_cost": "12.50",
            "eval_cost": "5.00",
            "prefix_cost": "67.50",
            "data_read_per_join": "5K"
          },
          "used_columns": [
            "id",
            "name",
            "email",
            "created_at"
          ]
        }
      }
    ]
  }
}`

const mysql_table_scan = `-> Filter: (users.created_at > '2024-01-01')  (cost=1025.00 rows=3333) (actual time=0.123..12.456 rows=2500 loops=1)
    -> Table scan on users  (cost=1025.00 rows=10000) (actual time=0.089..8.234 rows=10000 loops=1)
`

const mysql_table_scan_query = `SELECT * FROM users WHERE created_at > '2024-01-01';`

const mysql_table_scan_json = `{
  "query_block": {
    "select_id": 1,
    "cost_info": {
      "query_cost": "1025.00"
    },
    "table": {
      "table_name": "users",
      "access_type": "ALL",
      "rows_examined_per_scan": 10000,
      "rows_produced_per_join": 3333,
      "filtered": "33.33",
      "cost_info": {
        "read_cost": "691.67",
        "eval_cost": "333.33",
        "prefix_cost": "1025.00",
        "data_read_per_join": "3M"
      },
      "used_columns": [
        "id",
        "name",
        "email",
        "created_at"
      ],
      "attached_condition": "(\`users\`.\`created_at\` > '2024-01-01')"
    }
  }
}`

const mysql_complex_join = `-> Nested loop inner join  (cost=245.75 rows=100) (actual time=0.456..5.678 rows=85 loops=1)
    -> Nested loop inner join  (cost=125.50 rows=50) (actual time=0.234..2.345 rows=42 loops=1)
        -> Filter: (orders.status = 'completed')  (cost=50.25 rows=25) (actual time=0.123..1.234 rows=21 loops=1)
            -> Index range scan on orders using idx_created_at  (cost=25.00 rows=100) (actual time=0.089..0.567 rows=100 loops=1)
        -> Index lookup on users using PRIMARY (id=orders.user_id)  (cost=0.50 rows=2) (actual time=0.045..0.048 rows=2 loops=21)
    -> Index lookup on order_items using idx_order_id (order_id=orders.id)  (cost=1.25 rows=2) (actual time=0.067..0.072 rows=2 loops=42)
`

const mysql_complex_join_query = `SELECT u.name, o.id as order_id, oi.product_id, oi.quantity
FROM users u
INNER JOIN orders o ON u.id = o.user_id
INNER JOIN order_items oi ON o.id = oi.order_id
WHERE o.status = 'completed'
  AND o.created_at > '2024-01-01';`

const mysql_complex_join_json = `{
  "query_block": {
    "select_id": 1,
    "cost_info": {
      "query_cost": "245.75"
    },
    "nested_loop": [
      {
        "table": {
          "table_name": "orders",
          "access_type": "range",
          "possible_keys": [
            "idx_created_at",
            "idx_user_id"
          ],
          "key": "idx_created_at",
          "used_key_parts": [
            "created_at"
          ],
          "key_length": "5",
          "rows_examined_per_scan": 100,
          "rows_produced_per_join": 25,
          "filtered": "25.00",
          "cost_info": {
            "read_cost": "25.00",
            "eval_cost": "25.00",
            "prefix_cost": "50.00",
            "data_read_per_join": "2K"
          },
          "used_columns": [
            "id",
            "user_id",
            "status",
            "created_at"
          ],
          "attached_condition": "((\`orders\`.\`status\` = 'completed') and (\`orders\`.\`created_at\` > '2024-01-01'))"
        }
      },
      {
        "table": {
          "table_name": "users",
          "access_type": "eq_ref",
          "possible_keys": [
            "PRIMARY"
          ],
          "key": "PRIMARY",
          "used_key_parts": [
            "id"
          ],
          "key_length": "4",
          "ref": [
            "orders.user_id"
          ],
          "rows_examined_per_scan": 1,
          "rows_produced_per_join": 25,
          "filtered": "100.00",
          "cost_info": {
            "read_cost": "25.00",
            "eval_cost": "2.50",
            "prefix_cost": "77.50",
            "data_read_per_join": "2K"
          },
          "used_columns": [
            "id",
            "name"
          ]
        }
      },
      {
        "table": {
          "table_name": "order_items",
          "access_type": "ref",
          "possible_keys": [
            "idx_order_id"
          ],
          "key": "idx_order_id",
          "used_key_parts": [
            "order_id"
          ],
          "key_length": "4",
          "ref": [
            "orders.id"
          ],
          "rows_examined_per_scan": 2,
          "rows_produced_per_join": 50,
          "filtered": "100.00",
          "cost_info": {
            "read_cost": "50.00",
            "eval_cost": "5.00",
            "prefix_cost": "132.50",
            "data_read_per_join": "5K"
          },
          "used_columns": [
            "order_id",
            "product_id",
            "quantity"
          ]
        }
      }
    ]
  }
}`

export const samples: [string, string, string][] = [
  ["Simple Index Lookup", mysql_simple_index, mysql_simple_index_query],
  ["JOIN with Filter", mysql_join_example, mysql_join_query],
  ["Aggregate with GROUP BY", mysql_aggregate_example, mysql_aggregate_query],
  ["Subquery with IN", mysql_subquery_example, mysql_subquery_query],
  ["Table Scan (Missing Index)", mysql_table_scan, mysql_table_scan_query],
  ["Complex 3-Table JOIN", mysql_complex_join, mysql_complex_join_query],
]

export default samples
