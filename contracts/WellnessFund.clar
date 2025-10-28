(define-constant ERR-NOT-AUTHORIZED u100)
(define-constant ERR-FUND-NOT-FOUND u101)
(define-constant ERR-INVALID-AMOUNT u102)
(define-constant ERR-FUND-ALREADY-EXISTS u103)
(define-constant ERR-INVALID-NAME u104)
(define-constant ERR-INVALID-GOAL u105)
(define-constant ERR-INVALID-DURATION u106)
(define-constant ERR-INVALID-THRESHOLD u107)
(define-constant ERR-INVALID-STATUS u108)
(define-constant ERR-INVALID-TIMESTAMP u109)
(define-constant ERR-INVALID-CURRENCY u110)
(define-constant ERR-INVALID-LOCATION u111)
(define-constant ERR-INVALID-MIN-CONTRIB u112)
(define-constant ERR-INVALID-MAX-CONTRIB u113)
(define-constant ERR-INVALID-REWARD-RATE u114)
(define-constant ERR-INVALID-PENALTY u115)
(define-constant ERR-MAX-FUNDS-EXCEEDED u116)
(define-constant ERR-UPDATE-NOT-ALLOWED u117)
(define-constant ERR-INVALID-UPDATE-PARAM u118)
(define-constant ERR-AUTHORITY-NOT-SET u119)
(define-constant ERR-INVALID-AUTHORITY u120)

(define-trait fund-registry-trait
  ((register-fund (uint (string-ascii 50) uint principal) (response bool uint))
   (get-fund-id ((string-ascii 50)) (response (optional uint) uint))))

(define-trait audit-logger-trait
  ((log-event (principal (string-ascii 50) uint uint) (response bool uint))))

(define-trait governance-token-trait
  ((mint (principal uint) (response bool uint))))

(define-data-var next-fund-id uint u0)
(define-data-var max-funds uint u500)
(define-data-var creation-fee uint u500)
(define-data-var authority (optional principal) none)

(define-map funds
  uint
  {
    name: (string-ascii 50),
    goal: uint,
    duration: uint,
    threshold: uint,
    balance: uint,
    total-contributed: uint,
    timestamp: uint,
    creator: principal,
    currency: (string-ascii 10),
    location: (string-ascii 50),
    status: bool,
    min-contrib: uint,
    max-contrib: uint,
    reward-rate: uint,
    penalty: uint
  })

(define-map funds-by-name
  (string-ascii 50)
  uint)

(define-map fund-updates
  uint
  {
    update-name: (string-ascii 50),
    update-goal: uint,
    update-duration: uint,
    update-timestamp: uint,
    updater: principal
  })

(define-read-only (get-fund (id uint))
  (map-get? funds id))

(define-read-only (get-fund-balance (id uint))
  (ok (get balance (unwrap! (get-fund id) (err ERR-FUND-NOT-FOUND)))))

(define-read-only (get-total-contributed (id uint))
  (ok (get total-contributed (unwrap! (get-fund id) (err ERR-FUND-NOT-FOUND)))))

(define-read-only (get-fund-updates (id uint))
  (map-get? fund-updates id))

(define-read-only (is-fund-active (id uint))
  (ok (get status (unwrap! (get-fund id) (err ERR-FUND-NOT-FOUND)))))

(define-private (validate-name (name (string-ascii 50)))
  (if (and (> (len name) u0) (<= (len name) u50))
      (ok true)
      (err ERR-INVALID-NAME)))

(define-private (validate-goal (goal uint))
  (if (> goal u0)
      (ok true)
      (err ERR-INVALID-GOAL)))

(define-private (validate-duration (duration uint))
  (if (> duration u0)
      (ok true)
      (err ERR-INVALID-DURATION)))

(define-private (validate-threshold (threshold uint))
  (if (and (> threshold u0) (<= threshold u100))
      (ok true)
      (err ERR-INVALID-THRESHOLD)))

(define-private (validate-currency (cur (string-ascii 10)))
  (if (or (is-eq cur "STX") (is-eq cur "BTC"))
      (ok true)
      (err ERR-INVALID-CURRENCY)))

(define-private (validate-location (loc (string-ascii 50)))
  (if (and (> (len loc) u0) (<= (len loc) u50))
      (ok true)
      (err ERR-INVALID-LOCATION)))

(define-private (validate-min-contrib (min uint))
  (if (> min u0)
      (ok true)
      (err ERR-INVALID-MIN-CONTRIB)))

(define-private (validate-max-contrib (max uint))
  (if (> max u0)
      (ok true)
      (err ERR-INVALID-MAX-CONTRIB)))

(define-private (validate-reward-rate (rate uint))
  (if (<= rate u50)
      (ok true)
      (err ERR-INVALID-REWARD-RATE)))

(define-private (validate-penalty (pen uint))
  (if (<= pen u20)
      (ok true)
      (err ERR-INVALID-PENALTY)))

(define-private (validate-authority (p principal))
  (if (not (is-eq p tx-sender))
      (ok true)
      (err ERR-INVALID-AUTHORITY)))

(define-public (set-authority (contract-principal principal))
  (begin
    (try! (validate-authority contract-principal))
    (asserts! (is-none (var-get authority)) (err ERR-AUTHORITY-NOT-SET))
    (var-set authority (some contract-principal))
    (ok true)))

(define-public (set-max-funds (new-max uint))
  (begin
    (asserts! (> new-max u0) (err ERR-INVALID-UPDATE-PARAM))
    (asserts! (is-some (var-get authority)) (err ERR-AUTHORITY-NOT-SET))
    (var-set max-funds new-max)
    (ok true)))

(define-public (set-creation-fee (new-fee uint))
  (begin
    (asserts! (>= new-fee u0) (err ERR-INVALID-UPDATE-PARAM))
    (asserts! (is-some (var-get authority)) (err ERR-AUTHORITY-NOT-SET))
    (var-set creation-fee new-fee)
    (ok true)))

(define-public (create-fund
  (name (string-ascii 50))
  (goal uint)
  (duration uint)
  (threshold uint)
  (currency (string-ascii 10))
  (location (string-ascii 50))
  (min-contrib uint)
  (max-contrib uint)
  (reward-rate uint)
  (penalty uint)
  (registry <fund-registry-trait>)
  (logger <audit-logger-trait>))
  (let ((next-id (var-get next-fund-id))
        (current-max (var-get max-funds))
        (auth (var-get authority)))
    (asserts! (< next-id current-max) (err ERR-MAX-FUNDS-EXCEEDED))
    (try! (validate-name name))
    (try! (validate-goal goal))
    (try! (validate-duration duration))
    (try! (validate-threshold threshold))
    (try! (validate-currency currency))
    (try! (validate-location location))
    (try! (validate-min-contrib min-contrib))
    (try! (validate-max-contrib max-contrib))
    (try! (validate-reward-rate reward-rate))
    (try! (validate-penalty penalty))
    (asserts! (is-none (map-get? funds-by-name name)) (err ERR-FUND-ALREADY-EXISTS))
    (let ((auth-recipient (unwrap! auth (err ERR-AUTHORITY-NOT-SET))))
      (try! (stx-transfer? (var-get creation-fee) tx-sender auth-recipient)))
    (map-set funds next-id
      {name: name, goal: goal, duration: duration, threshold: threshold, balance: u0, total-contributed: u0,
       timestamp: block-height, creator: tx-sender, currency: currency, location: location, status: true,
       min-contrib: min-contrib, max-contrib: max-contrib, reward-rate: reward-rate, penalty: penalty})
    (map-set funds-by-name name next-id)
    (try! (contract-call? registry register-fund next-id name goal tx-sender))
    (try! (contract-call? logger log-event tx-sender "fund-created" next-id u0))
    (var-set next-fund-id (+ next-id u1))
    (print {event: "fund-created", id: next-id})
    (ok next-id)))

(define-public (contribute (fund-id uint) (amount uint) (logger <audit-logger-trait>) (token <governance-token-trait>))
  (let ((fund (unwrap! (get-fund fund-id) (err ERR-FUND-NOT-FOUND))))
    (asserts! (get status fund) (err ERR-INVALID-STATUS))
    (asserts! (and (>= amount (get min-contrib fund)) (<= amount (get max-contrib fund))) (err ERR-INVALID-AMOUNT))
    (try! (stx-transfer? amount tx-sender (as-contract tx-sender)))
    (let ((new-balance (+ (get balance fund) amount))
          (new-total (+ (get total-contributed fund) amount))
          (reward (/ (* amount (get reward-rate fund)) u100)))
      (map-set funds fund-id (merge fund {balance: new-balance, total-contributed: new-total}))
      (try! (contract-call? token mint tx-sender reward))
      (try! (contract-call? logger log-event tx-sender "contribution" fund-id amount))
      (print {event: "contribution", id: fund-id, amount: amount})
      (ok new-balance))))

(define-public (update-fund (fund-id uint) (update-name (string-ascii 50)) (update-goal uint) (update-duration uint))
  (let ((fund (unwrap! (map-get? funds fund-id) (err ERR-FUND-NOT-FOUND))))
    (asserts! (is-eq (get creator fund) tx-sender) (err ERR-NOT-AUTHORIZED))
    (try! (validate-name update-name))
    (try! (validate-goal update-goal))
    (try! (validate-duration update-duration))
    (let ((existing (map-get? funds-by-name update-name)))
      (match existing eid (asserts! (is-eq eid fund-id) (err ERR-FUND-ALREADY-EXISTS)) true))
    (let ((old-name (get name fund)))
      (if (not (is-eq old-name update-name))
          (begin (map-delete funds-by-name old-name) (map-set funds-by-name update-name fund-id))
          true))
    (map-set funds fund-id (merge fund {name: update-name, goal: update-goal, duration: update-duration, timestamp: block-height}))
    (map-set fund-updates fund-id {update-name: update-name, update-goal: update-goal, update-duration: update-duration, update-timestamp: block-height, updater: tx-sender})
    (print {event: "fund-updated", id: fund-id})
    (ok true)))

(define-public (close-fund (fund-id uint))
  (let ((fund (unwrap! (get-fund fund-id) (err ERR-FUND-NOT-FOUND))))
    (asserts! (is-eq (get creator fund) tx-sender) (err ERR-NOT-AUTHORIZED))
    (asserts! (get status fund) (err ERR-INVALID-STATUS))
    (map-set funds fund-id (merge fund {status: false}))
    (print {event: "fund-closed", id: fund-id})
    (ok true)))

(define-public (get-fund-count)
  (ok (var-get next-fund-id)))