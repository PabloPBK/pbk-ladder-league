                            className="border-t border-zinc-800"
                          >
                            <td className="px-4 py-3">
                              <input
                                type="checkbox"
                                checked={player.selected}
                                disabled={importing}
                                onChange={(event) =>
                                  updatePlayer(index, {
                                    selected:
                                      event.target.checked,
                                  })
                                }
                                className="h-4 w-4 accent-blue-500"
                                aria-label={`Select ${player.name}`}
                              />
                            </td>

                            <td className="px-4 py-3 font-semibold text-white">
                              {player.name}
                            </td>

                            <td className="px-4 py-3 text-zinc-400">
                              {player.email}
                            </td>

                            <td className="px-4 py-3 text-zinc-300">
                              {player.dupr?.toFixed(2) ??
                                "Unrated"}
                            </td>

                            <td className="px-4 py-3 text-zinc-400">
                              {player.podplayStatus}
                            </td>

                            <td className="px-4 py-3">
                              <select
                                value={player.attendance}
                                disabled={importing}
                                onChange={(event) =>
                                  updatePlayer(index, {
                                    attendance:
                                      event.target.value as Attendance,
                                  })
                                }
                                className="rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-white"
                              >
                                <option value="registered">
                                  Registered
                                </option>
                                <option value="attended">
                                  Attended
                                </option>
                                <option value="absent">
                                  Absent
                                </option>
                                <option value="cancelled">
                                  Cancelled
                                </option>
                              </select>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  <div className="border-t border-zinc-800 p-5">
                    <p className="mb-4 text-sm text-zinc-400">
                      Only selected players will be
                      imported. Review attendance
                      before saving.
                    </p>

                    <button
                      type="button"
                      disabled={
                        importing ||
                        selectedCount === 0 ||
                        !["scheduled", "in_progress"].includes(
                          session.status
                        )
                      }
                      onClick={() => void importRoster()}
                      className="rounded-xl bg-blue-600 px-6 py-3 font-bold text-white hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {importing
                        ? "Importing..."
                        : `Import ${selectedCount} Players`}
                    </button>
                  </div>
                </section>
              </>
            )}

            {result && (
              <section className="rounded-2xl border border-zinc-800 bg-zinc-900 p-6">
                <h2 className="text-xl font-bold">
                  Import Results
                </h2>

                <div className="mt-4 grid gap-4 sm:grid-cols-4">
                  {[
                    ["New Players", result.created],
                    ["Existing Players", result.existing],
                    ["Added to Session", result.added],
                    ["Already Assigned", result.skipped],
                  ].map(([label, value]) => (
                    <div key={label}>
                      <p className="text-sm text-zinc-400">
                        {label}
                      </p>
                      <p className="mt-1 text-2xl font-bold text-yellow-400">
                        {value}
                      </p>
                    </div>
                  ))}
                </div>
              </section>
            )}
          </>
        ) : (
          <p className="text-zinc-400">
            Rating session unavailable.
          </p>
        )}
      </div>
    </AppLayout>
